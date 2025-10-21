const Helper = require('../Helper/Helper');
const Register = require('../Models/RegisterModel');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');

const VehicleManagementController = {};

// Get all vehicles for a specific user
VehicleManagementController.getMyVehicles = async (req, res) => {
    try {
        const { userId } = req.query;
        
        console.log('Received userId:', userId);
        console.log('Type of userId:', typeof userId);
        
        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        // Try to find vehicles with userId as string first
        let vehicles = await Register.find({ userId: userId })
            .sort({ createdAt: -1 })
            .select('-__v');

        console.log('Found vehicles with string userId:', vehicles.length);

        // If no vehicles found, try with ObjectId
        if (vehicles.length === 0) {
            const mongoose = require('mongoose');
            try {
                const objectIdUserId = new mongoose.Types.ObjectId(userId);
                vehicles = await Register.find({ userId: objectIdUserId })
                    .sort({ createdAt: -1 })
                    .select('-__v');
                console.log('Found vehicles with ObjectId userId:', vehicles.length);
            } catch (objectIdError) {
                console.log('Invalid ObjectId format:', objectIdError.message);
            }
        }

        // If still no vehicles found, check if user has vehicles with null userId
        // This handles cases where vehicles were registered before userId was properly set
        if (vehicles.length === 0) {
            console.log('Checking for vehicles with null userId for user:', userId);
            // For now, we'll skip vehicles with null userId as they can't be properly attributed to a user
            // In a real scenario, you might want to update these vehicles with the correct userId
        }

        // If still no vehicles, try to find all vehicles to debug
        if (vehicles.length === 0) {
            const allVehicles = await Register.find({})
                .sort({ createdAt: -1 })
                .select('userId Name VehicleModel')
                .limit(5);
            console.log('Sample vehicles in database:', allVehicles.map(v => ({
                id: v._id,
                userId: v.userId,
                userIdType: typeof v.userId,
                name: v.Name,
                model: v.VehicleModel
            })));
        }

        Helper.response("Success", "Vehicles retrieved successfully", vehicles, res, 200);

    } catch (error) {
        console.error('Get my vehicles error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get a specific vehicle by ID
VehicleManagementController.getVehicleById = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { userId } = req.query;

        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing vehicleId or userId", {}, res, 400);
        }

        const vehicle = await Register.findOne({ 
            _id: vehicleId, 
            userId: userId 
        });

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        Helper.response("Success", "Vehicle retrieved successfully", vehicle, res, 200);

    } catch (error) {
        console.error('Get vehicle by ID error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update vehicle details
VehicleManagementController.updateVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { userId } = req.body;
        const updateData = req.body;

        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing vehicleId or userId", {}, res, 400);
        }

        // Remove userId from updateData to avoid updating it
        delete updateData.userId;

        // Validate required fields
        const requiredFields = ['rentalPrice', 'returnDuration', 'address', 'city', 'state', 'pincode', 'contactNo'];
        for (const field of requiredFields) {
            if (!updateData[field]) {
                return Helper.response("Failed", `Missing required field: ${field}`, {}, res, 400);
            }
        }

        // Check if vehicle exists and belongs to user
        const existingVehicle = await Register.findOne({ 
            _id: vehicleId, 
            userId: userId 
        });

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }

        // Check if vehicle has active bookings
        const activeBookings = await Booking.find({
            vehicleId: vehicleId,
            status: { $in: ['pending', 'accepted', 'in_progress'] }
        });

        if (activeBookings.length > 0) {
            return Helper.response("Failed", "Cannot update vehicle with active bookings", {}, res, 400);
        }

        // Update vehicle
        const updatedVehicle = await Register.findByIdAndUpdate(
            vehicleId,
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        Helper.response("Success", "Vehicle updated successfully", updatedVehicle, res, 200);

    } catch (error) {
        console.error('Update vehicle error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Delete vehicle
VehicleManagementController.deleteVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { userId } = req.query;

        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing vehicleId or userId", {}, res, 400);
        }

        // Check if vehicle exists and belongs to user
        const existingVehicle = await Register.findOne({ 
            _id: vehicleId, 
            userId: userId 
        });

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }

        // Check if vehicle has active bookings
        const activeBookings = await Booking.find({
            vehicleId: vehicleId,
            status: { $in: ['pending', 'accepted', 'in_progress'] }
        });

        if (activeBookings.length > 0) {
            return Helper.response("Failed", "Cannot delete vehicle with active bookings", {}, res, 400);
        }

        // Delete all related data
        await Promise.all([
            // Delete vehicle
            Register.findByIdAndDelete(vehicleId),
            // Delete all bookings for this vehicle
            Booking.deleteMany({ vehicleId: vehicleId }),
            // Delete all availability records for this vehicle
            Availability.deleteMany({ vehicleId: vehicleId })
        ]);

        Helper.response("Success", "Vehicle deleted successfully", {}, res, 200);

    } catch (error) {
        console.error('Delete vehicle error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Toggle vehicle availability
VehicleManagementController.toggleAvailability = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { userId, isAvailable } = req.body;

        if (!vehicleId || !userId || typeof isAvailable !== 'boolean') {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Check if vehicle exists and belongs to user
        const existingVehicle = await Register.findOne({ 
            _id: vehicleId, 
            userId: userId 
        });

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }

        // Update vehicle availability
        const updatedVehicle = await Register.findByIdAndUpdate(
            vehicleId,
            { 
                isAvailable: isAvailable,
                updatedAt: new Date()
            },
            { new: true }
        );

        Helper.response("Success", `Vehicle ${isAvailable ? 'made available' : 'made unavailable'}`, updatedVehicle, res, 200);

    } catch (error) {
        console.error('Toggle availability error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicle statistics
VehicleManagementController.getVehicleStats = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { userId } = req.query;

        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing vehicleId or userId", {}, res, 400);
        }

        // Check if vehicle exists and belongs to user
        const existingVehicle = await Register.findOne({ 
            _id: vehicleId, 
            userId: userId 
        });

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }

        // Get booking statistics
        const totalBookings = await Booking.countDocuments({ vehicleId: vehicleId });
        const completedBookings = await Booking.countDocuments({ 
            vehicleId: vehicleId, 
            status: 'completed' 
        });
        const pendingBookings = await Booking.countDocuments({ 
            vehicleId: vehicleId, 
            status: 'pending' 
        });
        const activeBookings = await Booking.countDocuments({ 
            vehicleId: vehicleId, 
            status: { $in: ['accepted', 'in_progress'] } 
        });

        // Calculate total earnings
        const Earnings = require('../Models/EarningsModel');
        const earnings = await Earnings.aggregate([
            { $match: { vehicleId: vehicleId } },
            { $group: { _id: null, totalEarnings: { $sum: '$netAmount' } } }
        ]);

        const totalEarnings = earnings.length > 0 ? earnings[0].totalEarnings : 0;

        const stats = {
            totalBookings,
            completedBookings,
            pendingBookings,
            activeBookings,
            totalEarnings,
            vehicle: {
                model: existingVehicle.VehicleModel,
                type: existingVehicle.vehicleType,
                category: existingVehicle.category,
                rentalPrice: existingVehicle.rentalPrice,
                isAvailable: existingVehicle.isAvailable
            }
        };

        Helper.response("Success", "Vehicle statistics retrieved successfully", stats, res, 200);

    } catch (error) {
        console.error('Get vehicle stats error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Debug endpoint to see all vehicles
VehicleManagementController.getAllVehiclesDebug = async (req, res) => {
    try {
        const allVehicles = await Register.find({})
            .sort({ createdAt: -1 })
            .select('userId Name VehicleModel category vehicleType')
            .limit(10);

        console.log('All vehicles in database:', allVehicles.map(v => ({
            id: v._id,
            userId: v.userId,
            userIdType: typeof v.userId,
            name: v.Name,
            model: v.VehicleModel,
            category: v.category,
            vehicleType: v.vehicleType
        })));

        Helper.response("Success", "Debug data retrieved", {
            totalVehicles: allVehicles.length,
            vehicles: allVehicles.map(v => ({
                id: v._id,
                userId: v.userId,
                userIdType: typeof v.userId,
                name: v.Name,
                model: v.VehicleModel,
                category: v.category,
                vehicleType: v.vehicleType
            }))
        }, res, 200);

    } catch (error) {
        console.error('Debug error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Utility endpoint to fix vehicles with null userId
VehicleManagementController.fixNullUserIdVehicles = async (req, res) => {
    try {
        const { userId, vehicleId } = req.body;
        
        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        let query = {};
        if (vehicleId) {
            query._id = vehicleId;
        } else {
            query.userId = null;
        }

        const vehiclesToUpdate = await Register.find(query);
        console.log(`Found ${vehiclesToUpdate.length} vehicles to update`);

        if (vehiclesToUpdate.length === 0) {
            return Helper.response("Success", "No vehicles with null userId found", {}, res, 200);
        }

        // Update vehicles with the provided userId
        const updateResult = await Register.updateMany(
            query,
            { 
                $set: { 
                    userId: userId,
                    updatedAt: new Date()
                } 
            }
        );

        console.log(`Updated ${updateResult.modifiedCount} vehicles with userId: ${userId}`);

        Helper.response("Success", `Updated ${updateResult.modifiedCount} vehicles with userId`, {
            modifiedCount: updateResult.modifiedCount,
            vehiclesUpdated: vehiclesToUpdate.map(v => ({
                id: v._id,
                name: v.Name,
                model: v.VehicleModel
            }))
        }, res, 200);

    } catch (error) {
        console.error('Fix null userId error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = VehicleManagementController;

