const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    // Admin Information
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    
    // Admin Role and Permissions
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator', 'support'],
        default: 'admin'
    },
    permissions: [{
        type: String,
        enum: ['manage_users', 'manage_vehicles', 'manage_bookings', 'manage_payments', 'manage_notifications', 'rto_assistance', 'view_analytics']
    }],
    
    // Admin Status
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    },
    
    // RTO Assistance Specialization
    rtoSpecialization: [{
        type: String,
        enum: ['registration', 'license', 'permit', 'fitness', 'insurance', 'pollution']
    }],
    assignedRegions: [{
        type: String
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
adminSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
adminSchema.index({ username: 1 });
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
