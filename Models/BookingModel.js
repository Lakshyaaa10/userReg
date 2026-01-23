const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // Renter Information
    renterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    renterName: {
        type: String,
        required: true
    },
    renterPhone: {
        type: String,
        required: true
    },
    renterEmail: {
        type: String,
        required: true
    },

    // Owner Information
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register', // Reference to vehicle owner
        required: true
    },
    ownerName: {
        type: String,
        required: true
    },
    ownerPhone: {
        type: String,
        required: true
    },

    // Vehicle Information
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    vehicleModel: {
        type: String,
        required: true
    },
    vehicleType: {
        type: String,
        required: true
    },
    vehiclePhoto: {
        type: String,
        required: true
    },

    // Booking Details
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    totalDays: {
        type: Number,
        required: true
    },
    pricePerDay: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },

    // Booking Status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed', 'in_progress', 'confirmed'],
        default: 'pending'
    },

    // Payment Information
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentId: {
        type: String,
        default: ''
    },
    paymentMethod: {
        type: String,
        default: ''
    },

    // Location Information
    pickupLocation: {
        type: String,
        required: true
    },
    dropoffLocation: {
        type: String,
        required: true
    },

    // Additional Information
    specialRequests: {
        type: String,
        default: ''
    },
    cancellationReason: {
        type: String,
        default: ''
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    acceptedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    }
});

// Add a pre-save hook to update the updatedAt field
bookingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
bookingSchema.index({ renterId: 1, status: 1 });
bookingSchema.index({ ownerId: 1, status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
