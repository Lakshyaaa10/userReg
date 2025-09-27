const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    // Vehicle Reference
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register',
        required: true
    },
    
    // Availability Details
    date: {
        type: Date,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    reason: {
        type: String,
        enum: ['personal_use', 'maintenance', 'booked', 'other'],
        default: 'personal_use'
    },
    customReason: {
        type: String,
        default: ''
    },
    
    // Time Slots (if needed for hourly bookings)
    timeSlots: [{
        startTime: String,
        endTime: String,
        isAvailable: {
            type: Boolean,
            default: true
        }
    }],
    
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
availabilitySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Compound index for better query performance
availabilitySchema.index({ vehicleId: 1, date: 1 });
availabilitySchema.index({ ownerId: 1, date: 1 });
availabilitySchema.index({ date: 1, isAvailable: 1 });

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
