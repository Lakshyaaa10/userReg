const Helper = require('../Helper/Helper');
const Admin = require('../Models/AdminModel');
const DriverLicense = require('../Models/DriverLicenseModel');
const Booking = require('../Models/BookingModel');
const Notification = require('../Models/NotificationModel');

const AdminController = {};

// Admin login
AdminController.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return Helper.response("Failed", "Username and password required", {}, res, 400);
        }

        const admin = await Admin.findOne({ username, isActive: true });
        if (!admin || admin.password !== password) {
            return Helper.response("Failed", "Invalid credentials", {}, res, 401);
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        Helper.response("Success", "Admin login successful", {
            adminId: admin._id,
            username: admin.username,
            role: admin.role,
            permissions: admin.permissions
        }, res, 200);

    } catch (error) {
        console.error('Admin login error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get pending driver license verifications
AdminController.getPendingVerifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const pendingLicenses = await DriverLicense.find({ verificationStatus: 'pending' })
            .populate('userId', 'mobile email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await DriverLicense.countDocuments({ verificationStatus: 'pending' });

        Helper.response("Success", "Pending verifications retrieved successfully", {
            pendingLicenses,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get pending verifications error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Verify driver license
AdminController.verifyDriverLicense = async (req, res) => {
    try {
        const { licenseId, status, adminId, rejectionReason } = req.body;

        if (!licenseId || !status || !adminId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const license = await DriverLicense.findById(licenseId);
        if (!license) {
            return Helper.response("Failed", "License not found", {}, res, 404);
        }

        // Update verification status
        license.verificationStatus = status;
        license.verifiedBy = adminId;
        license.verifiedAt = new Date();
        
        if (status === 'rejected' && rejectionReason) {
            license.rejectionReason = rejectionReason;
        }

        await license.save();

        // Create notification for user
        const notification = new Notification({
            userId: license.userId,
            title: "License Verification Update",
            message: `Your driver's license verification has been ${status}`,
            type: "general",
            relatedId: licenseId,
            relatedType: "user"
        });
        await notification.save();

        Helper.response("Success", `License ${status} successfully`, { license }, res, 200);

    } catch (error) {
        console.error('Verify driver license error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get RTO assistance requests
AdminController.getRTOAssistanceRequests = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // This would typically come from a separate RTO assistance model
        // For now, we'll get vehicle registrations that need RTO assistance
        const Register = require('../Models/RegisterModel');
        const rtoRequests = await Register.find({ rtoAssistanceRequested: true })
            .populate('userId', 'mobile email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Register.countDocuments({ rtoAssistanceRequested: true });

        Helper.response("Success", "RTO assistance requests retrieved successfully", {
            rtoRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get RTO assistance requests error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update RTO assistance status
AdminController.updateRTOAssistanceStatus = async (req, res) => {
    try {
        const { vehicleId, status, adminId, notes } = req.body;

        if (!vehicleId || !status || !adminId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const Register = require('../Models/RegisterModel');
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Update RTO assistance status
        vehicle.rtoAssistanceStatus = status;
        vehicle.rtoAssistanceNotes = notes || '';
        vehicle.rtoAssistanceUpdatedBy = adminId;
        vehicle.rtoAssistanceUpdatedAt = new Date();

        await vehicle.save();

        // Create notification for owner
        const notification = new Notification({
            userId: vehicle._id, // Assuming owner has a user account
            title: "RTO Assistance Update",
            message: `Your RTO assistance request status has been updated to: ${status}`,
            type: "rto_assistance",
            relatedId: vehicleId,
            relatedType: "vehicle"
        });
        await notification.save();

        Helper.response("Success", "RTO assistance status updated successfully", { vehicle }, res, 200);

    } catch (error) {
        console.error('Update RTO assistance status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get dashboard statistics
AdminController.getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await require('../Models/userModel').countDocuments();
        const totalVehicles = await require('../Models/RegisterModel').countDocuments();
        const totalBookings = await Booking.countDocuments();
        const pendingVerifications = await DriverLicense.countDocuments({ verificationStatus: 'pending' });
        const activeBookings = await Booking.countDocuments({ status: { $in: ['accepted', 'in_progress'] } });
        const completedBookings = await Booking.countDocuments({ status: 'completed' });

        const stats = {
            totalUsers,
            totalVehicles,
            totalBookings,
            pendingVerifications,
            activeBookings,
            completedBookings
        };

        Helper.response("Success", "Dashboard statistics retrieved successfully", stats, res, 200);

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get all bookings for admin
AdminController.getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (status) {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('renterId', 'mobile email')
            .populate('ownerId', 'Name ContactNo')
            .populate('vehicleId', 'VehicleModel vehicleType')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Booking.countDocuments(query);

        Helper.response("Success", "All bookings retrieved successfully", {
            bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get all bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = AdminController;
