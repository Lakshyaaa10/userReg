const mongoose = require('mongoose');

const driverLicenseSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true
    },
    
    // License Information
    licenseNumber: {
        type: String,
        required: true,
        unique: true
    },
    licenseType: {
        type: String,
        required: true,
        enum: ['MCWG', 'MCWOG', 'LMV', 'HMV', 'HGV']
    },
    issueDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    issuingAuthority: {
        type: String,
        required: true
    },
    
    // Document Uploads
    licenseFrontPhoto: {
        type: String,
        required: true
    },
    licenseBackPhoto: {
        type: String,
        required: true
    },
    
    // Verification Status
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    
    // Additional Information
    fullName: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    address: {
        type: String,
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
driverLicenseSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
driverLicenseSchema.index({ userId: 1 });
driverLicenseSchema.index({ verificationStatus: 1 });
driverLicenseSchema.index({ licenseNumber: 1 });

const DriverLicense = mongoose.model('DriverLicense', driverLicenseSchema);

module.exports = DriverLicense;
