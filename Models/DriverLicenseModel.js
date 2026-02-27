const mongoose = require('mongoose');

const driverLicenseSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true
    },
    
    // License Information (filled by admin during verification)
    licenseNumber: {
        type: String,
        default: ''
    },
    licenseType: {
        type: String,
        enum: ['MCWG', 'MCWOG', 'LMV', 'HMV', 'HGV', 'LMV+MCWG', ''],
        default: ''
    },
    issueDate: {
        type: Date,
        default: null
    },
    expiryDate: {
        type: Date,
        default: null
    },
    issuingAuthority: {
        type: String,
        default: ''
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
    
    // Additional Information (optional, filled by admin)
    fullName: {
        type: String,
        default: ''
    },
    dateOfBirth: {
        type: Date,
        default: null
    },
    address: {
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
driverLicenseSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better query performance
driverLicenseSchema.index({ userId: 1 });
driverLicenseSchema.index({ verificationStatus: 1 });
driverLicenseSchema.index({ licenseNumber: 1 });

const DriverLicense = mongoose.models.DriverLicense || mongoose.model('DriverLicense', driverLicenseSchema);

module.exports = DriverLicense;
