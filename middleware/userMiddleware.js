const jwt = require("jsonwebtoken");
const Helper = require("../Helper/Helper");
const userModel = require("../Models/userModel");

const userMiddleware = async (req, res, next) => {
    try {
        // Get token from authorization header
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return Helper.response("Failed", "Authorization token is required", {}, res, 401);
        }

        // Extract token from "Bearer <token>" format
        const tokenParts = authHeader.split(" ");
        if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
            return Helper.response("Failed", "Invalid token format. Use 'Bearer <token>'", {}, res, 401);
        }

        const token = tokenParts[1];

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return Helper.response("Failed", "Your Token is Expired", {}, res, 401);
            } else if (error.name === 'JsonWebTokenError') {
                return Helper.response("Failed", "Invalid token", {}, res, 401);
            } else {
                return Helper.response("Failed", "Token verification failed", {}, res, 401);
            }
        }

        // Find user by ID and verify token matches
        // This enforces single session - if token in DB is different, this one is invalid
        const user = await userModel.findOne({
            _id: decoded.id,
            token: token
        });

        if (!user) {
            return Helper.response("Failed", "Session expired due to login on another device. Please login again.", {}, res, 401);
        }

        // Attach user info to request object
        req.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            mobile: user.mobile
        };

        // Proceed to next middleware/controller
        next();

    } catch (error) {
        console.error('User middleware error:', error);
        Helper.response("Failed", "Unauthorized Access", {}, res, 401);
    }
};

module.exports = userMiddleware;
