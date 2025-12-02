const jwt = require("jsonwebtoken");
const Helper = require("../Helper/Helper");
const Admin = require("../Models/AdminModel");

const adminMiddleware = async (req, res, next) => {
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

        // Find admin by ID and verify token matches
        const admin = await Admin.findOne({ 
            _id: decoded.id, 
            token: token,
            isActive: true 
        });

        if (!admin) {
            return Helper.response("Failed", "Token expired due to another login. Please login again!", {}, res, 401);
        }

        // Attach admin info to request object for use in controllers
        req.admin = {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            permissions: admin.permissions
        };

        // Proceed to next middleware/controller
        next();

    } catch (error) {
        console.error('Admin middleware error:', error);
        Helper.response("Failed", "Unauthorized Access", {}, res, 401);
    }
};

module.exports = adminMiddleware;
