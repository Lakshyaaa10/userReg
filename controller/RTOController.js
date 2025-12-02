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

        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const vehicle = await RegisteredVehicles.findById(vehicleId)
            .populate('registerId', 'Name VehicleModel')
            .populate('rentalId', 'ownerName');
        
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Get vehicle model and owner name
        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const vehicleModel = vehicle.vehicleModel || register.VehicleModel || 'N/A';
        const ownerName = register.Name || rental.ownerName || 'N/A';
        
        // Note: RTO assistance fields might need to be added to RegisteredVehicles schema
        // For now, we'll just create the notification

        // Create notification for admin
        const adminNotification = new Notification({
            userId: 'admin', // This would be a special admin user ID
            title: "New RTO Assistance Request",
            message: `Vehicle ${vehicleModel} (${ownerName}) has requested RTO assistance`,
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

        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const vehicle = await RegisteredVehicles.findById(vehicleId)
            .populate('registerId', 'Name')
            .populate('rentalId', 'ownerName');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const vehicleModel = vehicle.vehicleModel || 'N/A';
        const ownerName = register.Name || rental.ownerName || 'N/A';

        Helper.response("Success", "RTO assistance status retrieved successfully", {
            vehicleId: vehicle._id,
            vehicleModel: vehicleModel,
            ownerName: ownerName,
            rtoAssistanceRequested: vehicle.rtoAssistanceRequested || false,
            rtoAssistanceStatus: vehicle.rtoAssistanceStatus || 'pending',
            rtoAssistanceNotes: vehicle.rtoAssistanceNotes || '',
            lastUpdated: vehicle.rtoAssistanceUpdatedAt || null
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

        const mongoose = require('mongoose');
        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const rtoRequests = await RegisteredVehicles.find({
            userId: objectIdUserId,
            rtoAssistanceRequested: true
        })
        .populate('registerId', 'Name')
        .populate('rentalId', 'ownerName')
        .select('vehicleModel vehicleType rtoAssistanceStatus rtoAssistanceNotes rtoAssistanceUpdatedAt createdAt registerId rentalId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // Map to include owner name
        const mappedRequests = rtoRequests.map(req => {
            const register = req.registerId || {};
            const rental = req.rentalId || {};
            return {
                ...req.toObject(),
                VehicleModel: req.vehicleModel,
                Name: register.Name || rental.ownerName || 'N/A'
            };
        });

        const totalCount = await RegisteredVehicles.countDocuments({
            userId: objectIdUserId,
            rtoAssistanceRequested: true
        });

        Helper.response("Success", "RTO assistance requests retrieved successfully", {
            rtoRequests: mappedRequests,
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
