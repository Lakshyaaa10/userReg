const mongoose = require('mongoose');

const earningsSchema = new mongoose.Schema({
    // Owner Reference
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    
    // Booking Reference
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    
    // Earnings Details
    grossAmount: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        required: true,
        default: 0
    },
    netAmount: {
        type: Number,
        required: true
    },
    
    // Payment Information
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    paymentDate: {
        type: Date,
        default: null
    },
    paymentMethod: {
        type: String,
        default: ''
    },
    
    // Trip Details
    tripStartDate: {
        type: Date,
        required: true
    },
    tripEndDate: {
        type: Date,
        required: true
    },
    tripDuration: {
        type: Number, // in days
        required: true
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

// Add a pre-save hook to update the updatedAt field
earningsSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
earningsSchema.index({ ownerId: 1, createdAt: -1 });
earningsSchema.index({ vehicleId: 1, createdAt: -1 });
earningsSchema.index({ paymentStatus: 1 });

const Earnings = mongoose.model('Earnings', earningsSchema);

module.exports = Earnings;
