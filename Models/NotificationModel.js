const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    
    // Notification Details
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['booking_request', 'booking_accepted', 'booking_rejected', 'payment_success', 'payment_failed', 'rto_assistance', 'vehicle_verification', 'general'],
        required: true
    },
    
    // Related Data
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    relatedType: {
        type: String,
        enum: ['booking', 'payment', 'vehicle', 'user'],
        default: null
    },
    
    // Notification Status
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    
    // Push Notification
    pushSent: {
        type: Boolean,
        default: false
    },
    pushSentAt: {
        type: Date,
        default: null
    },
    pushToken: {
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
    }
});

// Add a pre-save hook to update the updatedAt field
notificationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
