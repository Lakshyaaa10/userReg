const mongoose = require('mongoose');

const favoritesSchema = new mongoose.Schema({
    // User who added the vehicle to favorites
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Vehicle that was favorited
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    
    // Vehicle details (cached for faster access)
    vehicleDetails: {
        vehicleModel: {
            type: String,
            required: true
        },
        vehicleType: {
            type: String,
            required: true
        },
        category: {
            type: String,
            required: true
        },
        subcategory: {
            type: String,
            required: true
        },
        rentalPrice: {
            type: Number,
            required: true
        },
        hourlyPrice: {
            type: Number,
            default: null
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        vehiclePhoto: {
            type: String,
            required: true
        },
        ownerName: {
            type: String,
            required: true
        },
        ownerPhone: {
            type: String,
            required: true
        }
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure a user can't favorite the same vehicle twice
favoritesSchema.index({ userId: 1, vehicleId: 1 }, { unique: true });

// Add a pre-save hook to update the updatedAt field
favoritesSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Favorites = mongoose.model('Favorites', favoritesSchema);

module.exports = Favorites;
