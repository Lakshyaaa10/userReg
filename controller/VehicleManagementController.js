const Helper = require('../Helper/Helper');
const RegisteredVehicles = require('../Models/RegisteredVehicles');
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

        // Use RegisteredVehicles as primary model
        const mongoose = require('mongoose');
        let objectIdUserId;
        try {
            objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        } catch (objectIdError) {
            return Helper.response("Failed", "Invalid userId format", {}, res, 400);
        }

        // Find vehicles from RegisteredVehicles model
        let vehicles = await RegisteredVehicles.find({ userId: objectIdUserId })
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo')
            .populate('rentalId', 'businessName ownerName Address Landmark Pincode City State ContactNo')
            .sort({ createdAt: -1 })
            .select('-__v');

        console.log('Found vehicles with userId:', vehicles.length);

        // Map vehicles to include owner details from registerId or rentalId
        const mappedVehicles = vehicles.map(vehicle => {
            const register = vehicle.registerId || {};
            const rental = vehicle.rentalId || {};
            return {
                ...vehicle.toObject(),
                Name: register.Name || rental.ownerName || 'N/A',
                VehicleModel: vehicle.vehicleModel,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                ContactNo: register.ContactNo || rental.ContactNo || 'N/A',
                Pincode: register.Pincode || rental.Pincode || 'N/A',
            };
        });

        Helper.response("Success", "Vehicles retrieved successfully", mappedVehicles, res, 200);

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

        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

        const vehicle = await RegisteredVehicles.findOne({ 
            _id: vehicleId, 
            userId: objectIdUserId 
        })
        .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo')
        .populate('rentalId', 'businessName ownerName Address Landmark Pincode City State ContactNo');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Map vehicle to include owner details
        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const mappedVehicle = {
            ...vehicle.toObject(),
            Name: register.Name || rental.ownerName || 'N/A',
            VehicleModel: vehicle.vehicleModel,
            City: register.City || rental.City || 'N/A',
            State: register.State || rental.State || 'N/A',
            Address: register.Address || rental.Address || 'N/A',
            ContactNo: register.ContactNo || rental.ContactNo || 'N/A',
            Pincode: register.Pincode || rental.Pincode || 'N/A',
        };

        Helper.response("Success", "Vehicle retrieved successfully", mappedVehicle, res, 200);

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

        // Validate required fields - only rentalPrice is required for vehicle update
        if (!updateData.rentalPrice) {
            return Helper.response("Failed", "Missing required field: rentalPrice", {}, res, 400);
        }

        // Check if vehicle exists and belongs to user
        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const existingVehicle = await RegisteredVehicles.findOne({ 
            _id: vehicleId, 
            userId: objectIdUserId 
        })
        .populate('registerId')
        .populate('rentalId');

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }
        
        // If personal details need to be updated, update Register model
        if (updateData.address || updateData.city || updateData.state || updateData.pincode || updateData.contactNo) {
            if (existingVehicle.registerId) {
                await Register.findByIdAndUpdate(
                    existingVehicle.registerId,
                    {
                        Address: updateData.address,
                        City: updateData.city,
                        State: updateData.state,
                        Pincode: updateData.pincode,
                        ContactNo: updateData.contactNo,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
            }
        }
        
        // Remove personal detail fields from vehicle update data
        delete updateData.address;
        delete updateData.city;
        delete updateData.state;
        delete updateData.pincode;
        delete updateData.contactNo;
        delete updateData.returnDuration; // This might be in RegisteredVehicles, check schema

        // Check if vehicle has active bookings
        const activeBookings = await Booking.find({
            vehicleId: vehicleId,
            status: { $in: ['pending', 'accepted', 'in_progress'] }
        });

        if (activeBookings.length > 0) {
            return Helper.response("Failed", "Cannot update vehicle with active bookings", {}, res, 400);
        }

        // Update vehicle in RegisteredVehicles
        // Note: Personal details should be updated in Register model via registerId
        const updatedVehicle = await RegisteredVehicles.findByIdAndUpdate(
            vehicleId,
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        ).populate('registerId').populate('rentalId');

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
        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const existingVehicle = await RegisteredVehicles.findOne({ 
            _id: vehicleId, 
            userId: objectIdUserId 
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
            // Delete vehicle from RegisteredVehicles
            RegisteredVehicles.findByIdAndDelete(vehicleId),
            // Delete personal details from Register if registerId exists
            existingVehicle.registerId ? Register.findByIdAndDelete(existingVehicle.registerId) : Promise.resolve(),
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
        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const existingVehicle = await RegisteredVehicles.findOne({ 
            _id: vehicleId, 
            userId: objectIdUserId 
        });

        if (!existingVehicle) {
            return Helper.response("Failed", "Vehicle not found or unauthorized", {}, res, 404);
        }

        // Update vehicle availability
        const updatedVehicle = await RegisteredVehicles.findByIdAndUpdate(
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
        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const existingVehicle = await RegisteredVehicles.findOne({ 
            _id: vehicleId, 
            userId: objectIdUserId 
        })
        .populate('registerId')
        .populate('rentalId');

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
                model: existingVehicle.vehicleModel,
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
        const allVehicles = await RegisteredVehicles.find({})
            .populate('registerId', 'Name')
            .populate('rentalId', 'ownerName')
            .sort({ createdAt: -1 })
            .select('userId vehicleModel category vehicleType registerId rentalId')
            .limit(10);

        const mappedVehicles = allVehicles.map(v => ({
            id: v._id,
            userId: v.userId,
            userIdType: typeof v.userId,
            name: v.registerId?.Name || v.rentalId?.ownerName || 'N/A',
            model: v.vehicleModel,
            category: v.category,
            vehicleType: v.vehicleType
        }));

        console.log('All vehicles in database:', mappedVehicles);

        Helper.response("Success", "Debug data retrieved", {
            totalVehicles: allVehicles.length,
            vehicles: mappedVehicles
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

        const vehiclesToUpdate = await RegisteredVehicles.find(query);
        console.log(`Found ${vehiclesToUpdate.length} vehicles to update`);

        if (vehiclesToUpdate.length === 0) {
            return Helper.response("Success", "No vehicles with null userId found", {}, res, 200);
        }

        // Update vehicles with the provided userId
        const mongoose = require('mongoose');
        const objectIdUserId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        const updateResult = await RegisteredVehicles.updateMany(
            query,
            { 
                $set: { 
                    userId: objectIdUserId,
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

