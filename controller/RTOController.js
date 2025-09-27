const Helper = require('../Helper/Helper');
const Register = require('../Models/RegisterModel');
const Notification = require('../Models/NotificationModel');

const RTOController = {};

// Request RTO assistance (The "Magic Button" functionality)
RTOController.requestRTOAssistance = async (req, res) => {
    try {
        const { vehicleId, userId, assistanceType, notes } = req.body;

        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Update vehicle with RTO assistance request
        vehicle.rtoAssistanceRequested = true;
        vehicle.rtoAssistanceStatus = 'pending';
        vehicle.rtoAssistanceNotes = notes || '';
        vehicle.userId = userId; // Link to user account
        await vehicle.save();

        // Create notification for admin
        const adminNotification = new Notification({
            userId: 'admin', // This would be a special admin user ID
            title: "New RTO Assistance Request",
            message: `Vehicle ${vehicle.VehicleModel} (${vehicle.Name}) has requested RTO assistance`,
            type: "rto_assistance",
            relatedId: vehicleId,
            relatedType: "vehicle"
        });
        await adminNotification.save();

        // Create notification for owner
        const ownerNotification = new Notification({
            userId: userId,
            title: "RTO Assistance Requested",
            message: "Your RTO assistance request has been submitted. Our team will contact you soon.",
            type: "rto_assistance",
            relatedId: vehicleId,
            relatedType: "vehicle"
        });
        await ownerNotification.save();

        Helper.response("Success", "RTO assistance request submitted successfully", {
            vehicleId,
            status: 'pending',
            message: "Our RTO assistance team will contact you within 24 hours"
        }, res, 200);

    } catch (error) {
        console.error('Request RTO assistance error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get RTO assistance status
RTOController.getRTOAssistanceStatus = async (req, res) => {
    try {
        const { vehicleId } = req.query;

        if (!vehicleId) {
            return Helper.response("Failed", "Missing vehicleId", {}, res, 400);
        }

        const vehicle = await Register.findById(vehicleId)
            .select('rtoAssistanceRequested rtoAssistanceStatus rtoAssistanceNotes rtoAssistanceUpdatedAt VehicleModel Name');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        Helper.response("Success", "RTO assistance status retrieved successfully", {
            vehicleId: vehicle._id,
            vehicleModel: vehicle.VehicleModel,
            ownerName: vehicle.Name,
            rtoAssistanceRequested: vehicle.rtoAssistanceRequested,
            rtoAssistanceStatus: vehicle.rtoAssistanceStatus,
            rtoAssistanceNotes: vehicle.rtoAssistanceNotes,
            lastUpdated: vehicle.rtoAssistanceUpdatedAt
        }, res, 200);

    } catch (error) {
        console.error('Get RTO assistance status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get all RTO assistance requests for a user
RTOController.getUserRTORequests = async (req, res) => {
    try {
        const { userId, page = 1, limit = 20 } = req.query;

        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        const skip = (page - 1) * limit;

        const rtoRequests = await Register.find({
            userId: userId,
            rtoAssistanceRequested: true
        })
        .select('VehicleModel vehicleType rtoAssistanceStatus rtoAssistanceNotes rtoAssistanceUpdatedAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const totalCount = await Register.countDocuments({
            userId: userId,
            rtoAssistanceRequested: true
        });

        Helper.response("Success", "RTO assistance requests retrieved successfully", {
            rtoRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get user RTO requests error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = RTOController;
