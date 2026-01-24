const userModel = require("../Models/userModel");
const bodyParser = require("body-parser");
const Helper = require("../Helper/Helper");
const jwt = require("jsonwebtoken");
exports.createUser = async (req, res) => {
  try {
    const { mobile, password, email, username, referralCode, Name, fullName } = req.body;

    // Allow Name or fullName to be used as username if username is not explicitly provided
    const finalUsername = username || Name || fullName;
    const finalFullName = fullName || Name;

    // For regular signup, password is required (OAuth users don't use this endpoint)
    if (!mobile || !password || !email || !finalUsername) {
      return Helper.response(
        "Failed",
        "Mobile number, email, username, and password are required",
        {},
        res,
        400
      );
    }

    const existingUser = await userModel.findOne({
      $or: [{ mobile }, { email }, { username: finalUsername }],
    });

    if (existingUser) {
      return Helper.response(
        "Failed",
        "Mobile, Email, or Username already in use",
        {},
        res,
        409
      );
    }

    // Generate unique referral code for the new user
    // Format: Username (first 4 chars) + Random 4 alphanumeric
    const safeUsername = finalUsername || "USER";
    const baseName = safeUsername.substring(0, 4).toUpperCase();
    const uniqueRef = baseName + Math.random().toString(36).substr(2, 4).toUpperCase();

    let walletPoints = 0;
    let referredBy = null;

    // Handle Referral Logic
    if (referralCode) {
      const referrer = await userModel.findOne({ referralCode });
      if (referrer) {
        // Credit referrer (50 points)
        referrer.walletPoints = (referrer.walletPoints || 0) + 50;
        referrer.referralHistory.push({
          userId: null, // We'll update this with real ID after save if needed, but for now we haven't saved newUser yet.
          // Actually simpler: we can't push userId yet.
          // Let's just add points now and maybe add history later or just trust the count.
          // Better: Save newUser first then update referrer.
        });

        // We need to save referrer changes. 
        // To properly link, we should do this after newUser is created.
        referredBy = referrer._id;
        walletPoints = 20; // Signup bonus for using code
      }
    }

    const newUser = new userModel({
      mobile,
      password,
      email,
      username: finalUsername,
      fullName: finalFullName,
      referralCode: uniqueRef,
      walletPoints,
      referredBy
    });

    const savedUser = await newUser.save();

    // If there was a referrer, update their history now that we have savedUser._id
    if (referredBy) {
      await userModel.findByIdAndUpdate(referredBy, {
        $inc: { walletPoints: 50 },
        $push: {
          referralHistory: {
            userId: savedUser._id,
            pointsEarned: 50,
            date: new Date()
          }
        }
      });
    }

    return Helper.response(
      "Success",
      "User Created Successfully",
      { userId: savedUser._id },
      res,
      201
    );
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
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
    const token = req.headers["authorization"];
    const string = token.split(" ")[1];
    const user = await userModel.findOne({ token: string });

    if (user) {
      const logout = await userModel.updateOne(
        { token: string },
        { $set: { token: "" } }
      );

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
