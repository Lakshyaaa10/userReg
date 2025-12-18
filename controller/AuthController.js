const userModel = require("../Models/userModel");
const bodyParser = require("body-parser");
const Helper = require("../Helper/Helper");
const jwt = require("jsonwebtoken");
exports.createUser = async (req, res) => {
  try {
    const { mobile, password, email, username } = req.body;

    // For regular signup, password is required (OAuth users don't use this endpoint)
    if (!mobile || !password || !email || !username) {
      return res
        .status(400)
        .send("Mobile number, email, username, and password are required");
    }

    const existingUser = await userModel.findOne({
      $or: [{ mobile }, { email }, { username }],
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

    const newUser = new userModel({
      mobile,
      password,
      email,
      username,
    });

    const savedUser = await newUser.save();

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
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return Helper.response(
        "Failed",
        "Please provide Username and Password",
        {},
        res,
        200
      );
    }
    const user = await userModel.findOne({ mobile: mobile });

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
          },
          res,
          200
        );
      });
    } else {
      Helper.response("Failed", "No User Found", {}, res, 200);
    }
  } catch (err) {
    console.log(err);
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
