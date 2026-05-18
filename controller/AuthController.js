const userModel = require("../Models/userModel");
const Helper = require("../Helper/Helper");
const jwt = require("jsonwebtoken");
const PendingSignup = require("../Models/PendingSignupModel");
const { sendEmail } = require("../helpers/emailService");
const { renderTemplate } = require("../helpers/emailTemplateService");

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_GAP_MS = 30 * 1000;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function ensureUserUniqueness({ mobile, email, username }) {
  const existingUser = await userModel.findOne({
    $or: [{ mobile }, { email }, { username }],
  });

  if (existingUser) {
    throw new Error("Mobile, Email, or Username already in use");
  }
}

async function buildReferralState(referralCode) {
  let walletPoints = 0;
  let referredBy = null;

  if (referralCode) {
    const referrer = await userModel.findOne({ referralCode });
    if (referrer) {
      referredBy = referrer._id;
      walletPoints = 20;
    }
  }

  return { walletPoints, referredBy };
}

async function createUserRecord({
  mobile,
  password,
  email,
  username,
  referralCode,
  Name,
  fullName,
}) {
  const finalUsername = username || Name || fullName;
  const finalFullName = fullName || Name || "";

  if (!mobile || !password || !email || !finalUsername) {
    throw new Error("Mobile number, email, username, and password are required");
  }

  await ensureUserUniqueness({
    mobile,
    email,
    username: finalUsername,
  });

  const safeUsername = finalUsername || "USER";
  const baseName = safeUsername.substring(0, 4).toUpperCase();
  const uniqueRef =
    baseName + Math.random().toString(36).substr(2, 4).toUpperCase();

  const { walletPoints, referredBy } = await buildReferralState(referralCode);

  const newUser = new userModel({
    mobile,
    password,
    email,
    username: finalUsername,
    fullName: finalFullName,
    referralCode: uniqueRef,
    walletPoints,
    referredBy,
  });

  const savedUser = await newUser.save();

  if (referredBy) {
    await userModel.findByIdAndUpdate(referredBy, {
      $inc: { walletPoints: 50 },
      $push: {
        referralHistory: {
          userId: savedUser._id,
          pointsEarned: 50,
          date: new Date(),
        },
      },
    });
  }

  return savedUser;
}

async function sendSignupOtpEmail({ email, otp, username, mobile }) {
  const html = renderTemplate("otp-email.pug", {
    previewText: `${otp} is your ${process.env.EMAIL_BRAND_NAME || "Zugo"} verification code`,
    heading: "Verify your email",
    recipientName: username,
    otp,
    email,
    mobile,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  });

  await sendEmail({
    to: email,
    subject: `${process.env.EMAIL_BRAND_NAME || "Zugo"} email verification code`,
    html,
    text: `Your OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
  });
}

exports.createUser = async (req, res) => {
  try {
    const savedUser = await createUserRecord(req.body);

    return Helper.response(
      "Success",
      "User Created Successfully",
      { userId: savedUser._id },
      res,
      201
    );
  } catch (error) {
    console.error(error);
    const statusCode =
      error.message === "Mobile, Email, or Username already in use"
        ? 409
        : error.message === "Mobile number, email, username, and password are required"
        ? 400
        : 500;
    return Helper.response("Failed", error.message || "Internal Server Error", {}, res, statusCode);
  }
};
exports.requestSignupOtp = async (req, res) => {
  try {
    const {
      mobile,
      password,
      email,
      username,
      referralCode,
      Name,
      fullName,
    } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const finalUsername = username || Name || fullName;

    if (!mobile || !password || !normalizedEmail || !finalUsername) {
      return Helper.response(
        "Failed",
        "Mobile, email, username, password required",
        {},
        res,
        400
      );
    }

    await ensureUserUniqueness({
      mobile: Number(mobile),
      email: normalizedEmail,
      username: finalUsername,
    });

    const existingPending = await PendingSignup.findOne({
      $or: [{ email: normalizedEmail }, { mobile: Number(mobile) }],
    });

    if (
      existingPending?.lastSentAt &&
      Date.now() - new Date(existingPending.lastSentAt).getTime() < OTP_RESEND_GAP_MS
    ) {
      return Helper.response(
        "Failed",
        "Wait before requesting another OTP",
        {},
        res,
        429
      );
    }

    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await PendingSignup.findOneAndUpdate(
      existingPending ? { _id: existingPending._id } : { email: normalizedEmail },
      {
        email: normalizedEmail,
        mobile: Number(mobile),
        username: finalUsername,
        fullName: fullName || Name || "",
        password,
        referralCode: referralCode || "",
        otp,
        otpExpiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendSignupOtpEmail({
      email: normalizedEmail,
      otp,
      username: finalUsername,
      mobile,
    });

    return Helper.response(
      "Success",
      "OTP sent to email",
      {
        email: normalizedEmail,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      },
      res,
      200
    );
  } catch (error) {
    console.error("requestSignupOtp error:", error);
    const conflict =
      error.message === "Mobile, Email, or Username already in use";
    return Helper.response(
      "Failed",
      error.message || "Unable to send OTP",
      {},
      res,
      conflict ? 409 : 500
    );
  }
};

exports.verifySignupOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!normalizedEmail || !otp) {
      return Helper.response("Failed", "Email and OTP required", {}, res, 400);
    }

    const pendingSignup = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pendingSignup) {
      return Helper.response("Failed", "OTP request not found", {}, res, 404);
    }

    if (pendingSignup.otpExpiresAt < new Date()) {
      await PendingSignup.deleteOne({ _id: pendingSignup._id });
      return Helper.response("Failed", "OTP expired", {}, res, 400);
    }

    if (pendingSignup.otp !== otp) {
      pendingSignup.attempts = (pendingSignup.attempts || 0) + 1;
      await pendingSignup.save();
      return Helper.response("Failed", "Invalid OTP", {}, res, 400);
    }

    const savedUser = await createUserRecord({
      mobile: pendingSignup.mobile,
      password: pendingSignup.password,
      email: pendingSignup.email,
      username: pendingSignup.username,
      fullName: pendingSignup.fullName,
      referralCode: pendingSignup.referralCode,
    });

    await PendingSignup.deleteOne({ _id: pendingSignup._id });

    return Helper.response(
      "Success",
      "Email verified. User created successfully",
      { userId: savedUser._id },
      res,
      201
    );
  } catch (error) {
    console.error("verifySignupOtp error:", error);
    const statusCode =
      error.message === "Mobile, Email, or Username already in use" ? 409 : 500;
    return Helper.response(
      "Failed",
      error.message || "OTP verification failed",
      {},
      res,
      statusCode
    );
  }
};

exports.resendSignupOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail) {
      return Helper.response("Failed", "Email required", {}, res, 400);
    }

    const pendingSignup = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pendingSignup) {
      return Helper.response("Failed", "Signup request not found", {}, res, 404);
    }

    if (
      pendingSignup.lastSentAt &&
      Date.now() - new Date(pendingSignup.lastSentAt).getTime() < OTP_RESEND_GAP_MS
    ) {
      return Helper.response(
        "Failed",
        "Wait before requesting another OTP",
        {},
        res,
        429
      );
    }

    pendingSignup.otp = generateOtp();
    pendingSignup.otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );
    pendingSignup.lastSentAt = new Date();
    pendingSignup.attempts = 0;
    await pendingSignup.save();

    await sendSignupOtpEmail({
      email: pendingSignup.email,
      otp: pendingSignup.otp,
      username: pendingSignup.username,
      mobile: pendingSignup.mobile,
    });

    return Helper.response(
      "Success",
      "OTP resent to email",
      {
        email: pendingSignup.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      },
      res,
      200
    );
  } catch (error) {
    console.error("resendSignupOtp error:", error);
    return Helper.response(
      "Failed",
      error.message || "Unable to resend OTP",
      {},
      res,
      500
    );
  }
};
exports.Login = async (req, res) => {
  try {
    const { identifier, mobile, password } = req.body;

    // Support both 'identifier' (new) and 'mobile' (legacy) fields
    const loginId = identifier || mobile;

    if (!loginId || !password) {
      return Helper.response(
        "Failed",
        "Please provide Email/Phone and Password",
        {},
        res,
        200
      );
    }

    let query = {};

    // Check if loginId is an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(loginId)) {
      query = { email: loginId };
    } else {
      // Assume it's a mobile number
      // Clean the number if needed, but for now assuming clean input or matching DB format
      // DB mobile is Number, so we parse it.
      const mobileNumber = Number(loginId);
      if (isNaN(mobileNumber)) {
        return Helper.response("Failed", "Invalid Email or Phone Number format", {}, res, 200);
      }
      query = { mobile: mobileNumber };
    }

    const user = await userModel.findOne(query);

    if (user && user.password === password) {
      let token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
        expiresIn: "50m",
      });
      Helper.updateToken(user._id, token).then((data) => {
        Helper.response(
          "Success",
          "Logged In successfully.",
          {
            id: user.id,
            username: user.username,
            email: user.email,
            mobile: user.mobile,
            token: token,
            base_url: process.env.BASE_URL,
            userType: user.userType,
          },
          res,
          200
        );
      });
    } else {
      Helper.response("Failed", "Invalid Credentials", {}, res, 200);
    }
  } catch (err) {
    console.log(err);
    Helper.response("Failed", "An error occurred during login", {}, res, 200);
  }
};
exports.Logout = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return Helper.response("Failed", "Authorization token is required", {}, res, 401);
    }

    const tokenParts = authHeader.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return Helper.response("Failed", "Invalid token format. Use 'Bearer <token>'", {}, res, 401);
    }

    const token = tokenParts[1];
    const decoded = jwt.decode(token);

    let user = await userModel.findOneAndUpdate(
      { token: token },
      { $set: { token: "" } },
      { new: true }
    );

    if (!user && decoded && decoded.id) {
      user = await userModel.findByIdAndUpdate(
        decoded.id,
        { $set: { token: "" } },
        { new: true }
      );
    }

    if (user) {
      Helper.response("Success", "Logout Successfully", {}, res, 200);
    } else {
      Helper.response("Failed", "Unable to Logout", {}, res, 200);
    }
  } catch (error) {
    console.log(error);
    Helper.response("Failed", "Unable to Logout ", error, res, 200);
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const token = req.headers["authorization"];
    const string = token.split(" ")[1];
    const user = await userModel.findOne({ token: string });
    if (user) {
      Helper.response("Success", "User Found", user, res, 200);
    }
    else {
      Helper.response("Failed", "No User Found", {}, res, 200);
    }
  } catch (error) {
    console.log(error);
    Helper.response("Failed", "Internal Server Error", error, res, 200);
  }
};

// Google OAuth Login/Register
exports.googleAuth = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return Helper.response(
        "Failed",
        "Google access token is required",
        {},
        res,
        400
      );
    }

    // Get user info from Google using access token
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );

      if (!response.ok) {
        return Helper.response(
          "Failed",
          "Invalid Google token",
          {},
          res,
          401
        );
      }

      const googleUser = await response.json();

      if (googleUser.error) {
        return Helper.response(
          "Failed",
          "Invalid Google token",
          {},
          res,
          401
        );
      }

      // Use id or sub as Google ID (Google userinfo API returns 'id')
      const googleId = googleUser.id || googleUser.sub;

      if (!googleId || !googleUser.email) {
        return Helper.response(
          "Failed",
          "Invalid Google user data",
          {},
          res,
          400
        );
      }

      // Check if user exists with this Google ID
      let user = await userModel.findOne({ googleId: googleId });

      if (user) {
        // User exists, log them in
        let token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
          expiresIn: "50m",
        });
        await Helper.updateToken(user._id, token);
        return Helper.response(
          "Success",
          "Logged in successfully with Google",
          {
            id: user._id,
            username: user.username || googleUser.name || googleUser.email.split("@")[0],
            email: user.email || googleUser.email,
            mobile: user.mobile || null,
            token: token,
            base_url: process.env.BASE_URL,
          },
          res,
          200
        );
      } else {
        // Check if user exists with this email
        const existingUser = await userModel.findOne({ email: googleUser.email });

        if (existingUser) {
          // Link Google account to existing user
          existingUser.googleId = googleId;
          if (!existingUser.fullName && googleUser.name) {
            existingUser.fullName = googleUser.name;
          }
          await existingUser.save();

          let token = jwt.sign({ id: existingUser._id }, process.env.SECRET_KEY, {
            expiresIn: "50m",
          });
          await Helper.updateToken(existingUser._id, token);
          return Helper.response(
            "Success",
            "Google account linked successfully",
            {
              id: existingUser._id,
              username: existingUser.username,
              email: existingUser.email,
              mobile: existingUser.mobile,
              token: token,
              base_url: process.env.BASE_URL,
            },
            res,
            200
          );
        }

        // Create new user
        const username = googleUser.email.split("@")[0] + "_" + Date.now().toString().slice(-6);
        const newUser = new userModel({
          googleId: googleId,
          email: googleUser.email,
          username: username,
          fullName: googleUser.name || "",
          password: "", // No password for OAuth users
        });

        const savedUser = await newUser.save();
        let token = jwt.sign({ id: savedUser._id }, process.env.SECRET_KEY, {
          expiresIn: "50m",
        });
        await Helper.updateToken(savedUser._id, token);

        return Helper.response(
          "Success",
          "Account created successfully with Google",
          {
            id: savedUser._id,
            username: savedUser.username,
            email: savedUser.email,
            mobile: savedUser.mobile || null,
            token: token,
            base_url: process.env.BASE_URL,
          },
          res,
          201
        );
      }
    } catch (fetchError) {
      console.error("Google API error:", fetchError);
      return Helper.response(
        "Failed",
        "Failed to verify Google token",
        { error: fetchError.message },
        res,
        401
      );
    }
  } catch (error) {
    console.error("Google OAuth error:", error);
    return Helper.response(
      "Failed",
      "Google authentication failed",
      { error: error.message },
      res,
      500
    );
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const token = req.headers["authorization"];
    if (!token) {
      return Helper.response("Failed", "No token provided", {}, res, 401);
    }
    const string = token.split(" ")[1];
    
    // Find the user by token
    const user = await userModel.findOne({ token: string });

    if (!user) {
        return Helper.response("Failed", "User not found or already deleted", {}, res, 404);
    }

    // Delete the user record
    await userModel.findByIdAndDelete(user._id);

    return Helper.response("Success", "Account deleted successfully", {}, res, 200);
  } catch (error) {
    console.error("Delete Account error:", error);
    return Helper.response("Failed", "Internal Server Error", error.message, res, 500);
  }
};
