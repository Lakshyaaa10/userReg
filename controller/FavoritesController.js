const Helper = require('../Helper/Helper');
const Favorites = require('../Models/FavoritesModel');
const Register = require('../Models/RegisterModel');
const User = require('../Models/userModel');

const FavoritesController = {};

// Add vehicle to favorites
FavoritesController.addToFavorites = async (req, res) => {
    try {
        const { vehicleId, userId } = req.body;

        // Validation
        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Check if vehicle exists
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return Helper.response("Failed", "User not found", {}, res, 404);
        }

        // Check if already in favorites
        const existingFavorite = await Favorites.findOne({
            userId: userId,
            vehicleId: vehicleId
        });

        if (existingFavorite) {
            return Helper.response("Failed", "Vehicle already in favorites", {}, res, 400);
        }

        // Get owner details
        const owner = await User.findById(vehicle.userId);
        const ownerName = owner ? (owner.name || 'Unknown Owner') : 'Unknown Owner';
        const ownerPhone = owner ? (owner.contact || owner.phone || 'N/A') : 'N/A';

        // Create favorite entry
        const newFavorite = new Favorites({
            userId: userId,
            vehicleId: vehicleId,
            vehicleDetails: {
                vehicleModel: vehicle.VehicleModel || 'Unknown Model',
                vehicleType: vehicle.vehicleType || 'bike',
                category: vehicle.category || '2-wheeler',
                subcategory: vehicle.subcategory || 'Bike',
                rentalPrice: vehicle.rentalPrice || 0,
                hourlyPrice: vehicle.hourlyPrice || null,
                city: vehicle.City || 'Unknown City',
                state: vehicle.State || 'Unknown State',
                vehiclePhoto: vehicle.VehiclePhoto || '',
                ownerName: ownerName,
                ownerPhone: ownerPhone
            }
        });

        await newFavorite.save();

        Helper.response("Success", "Vehicle added to favorites", { favorite: newFavorite }, res, 201);

    } catch (error) {
        console.error('Add to favorites error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Remove vehicle from favorites
FavoritesController.removeFromFavorites = async (req, res) => {
    try {
        const { vehicleId, userId } = req.body;

        // Validation
        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Find and delete the favorite
        const favorite = await Favorites.findOneAndDelete({
            userId: userId,
            vehicleId: vehicleId
        });

        if (!favorite) {
            return Helper.response("Failed", "Vehicle not found in favorites", {}, res, 404);
        }

        Helper.response("Success", "Vehicle removed from favorites", {}, res, 200);

    } catch (error) {
        console.error('Remove from favorites error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get user's favorite vehicles
FavoritesController.getUserFavorites = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // Validation
        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        const skip = (page - 1) * limit;

        // Get favorites with pagination
        const favorites = await Favorites.find({ userId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalCount = await Favorites.countDocuments({ userId: userId });

        Helper.response("Success", "Favorites retrieved successfully", {
            favorites: favorites,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasNextPage: skip + parseInt(limit) < totalCount,
                hasPrevPage: page > 1
            }
        }, res, 200);

    } catch (error) {
        console.error('Get user favorites error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Check if vehicle is in user's favorites
FavoritesController.checkFavoriteStatus = async (req, res) => {
    try {
        const { vehicleId, userId } = req.query;

        // Validation
        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Check if vehicle is in favorites
        const favorite = await Favorites.findOne({
            userId: userId,
            vehicleId: vehicleId
        });

        Helper.response("Success", "Favorite status retrieved", {
            isFavorite: !!favorite,
            favoriteId: favorite ? favorite._id : null
        }, res, 200);

    } catch (error) {
        console.error('Check favorite status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Toggle favorite status (add if not exists, remove if exists)
FavoritesController.toggleFavorite = async (req, res) => {
    try {
        const { vehicleId, userId } = req.body;

        // Validation
        if (!vehicleId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Check if vehicle exists
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return Helper.response("Failed", "User not found", {}, res, 404);
        }

        // Check if already in favorites
        const existingFavorite = await Favorites.findOne({
            userId: userId,
            vehicleId: vehicleId
        });

        if (existingFavorite) {
            // Remove from favorites
            await Favorites.findByIdAndDelete(existingFavorite._id);
            Helper.response("Success", "Vehicle removed from favorites", {
                isFavorite: false,
                action: 'removed'
            }, res, 200);
        } else {
            // Add to favorites
            const owner = await User.findById(vehicle.userId);
            const ownerName = owner ? (owner.name || 'Unknown Owner') : 'Unknown Owner';
            const ownerPhone = owner ? (owner.contact || owner.phone || 'N/A') : 'N/A';

            const newFavorite = new Favorites({
                userId: userId,
                vehicleId: vehicleId,
                vehicleDetails: {
                    vehicleModel: vehicle.VehicleModel || 'Unknown Model',
                    vehicleType: vehicle.vehicleType || 'bike',
                    category: vehicle.category || '2-wheeler',
                    subcategory: vehicle.subcategory || 'Bike',
                    rentalPrice: vehicle.rentalPrice || 0,
                    hourlyPrice: vehicle.hourlyPrice || null,
                    city: vehicle.City || 'Unknown City',
                    state: vehicle.State || 'Unknown State',
                    vehiclePhoto: vehicle.VehiclePhoto || '',
                    ownerName: ownerName,
                    ownerPhone: ownerPhone
                }
            });

            await newFavorite.save();

            Helper.response("Success", "Vehicle added to favorites", {
                isFavorite: true,
                action: 'added',
                favorite: newFavorite
            }, res, 201);
        }

    } catch (error) {
        console.error('Toggle favorite error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = FavoritesController;
