const Helper = require('../Helper/Helper');
const DriverLicense = require('../Models/DriverLicenseModel');
const cloudinary = require('cloudinary');

const LicenseController = {};

// ============================================
// USER: Submit driver's license for verification
// ============================================
LicenseController.submitLicense = async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if license photos are uploaded
        if (!req.files || !req.files.licenseFrontPhoto || !req.files.licenseBackPhoto) {
            return Helper.response("Failed", "Both front and back photos of the license are required", {}, res, 400);
        }

        // Check if user already has a license submission
        const existingLicense = await DriverLicense.findOne({ userId });
        if (existingLicense && existingLicense.verificationStatus === 'verified') {
            return Helper.response("Failed", "Your license is already verified", { status: 'verified' }, res, 400);
        }
        if (existingLicense && existingLicense.verificationStatus === 'pending') {
            return Helper.response("Failed", "Your license verification is already pending", { status: 'pending' }, res, 400);
        }

        // Upload front photo to Cloudinary
        const frontUpload = await cloudinary.v2.uploader.upload(req.files.licenseFrontPhoto.tempFilePath, {
            folder: "DriverLicense",
            use_filename: true,
            unique_filename: true,
            resource_type: "image",
        });

        // Upload back photo to Cloudinary
        const backUpload = await cloudinary.v2.uploader.upload(req.files.licenseBackPhoto.tempFilePath, {
            folder: "DriverLicense",
            use_filename: true,
            unique_filename: true,
            resource_type: "image",
        });

        // If rejected license exists, update photos and re-submit
        if (existingLicense && existingLicense.verificationStatus === 'rejected') {
            existingLicense.licenseFrontPhoto = frontUpload.secure_url;
            existingLicense.licenseBackPhoto = backUpload.secure_url;
            existingLicense.verificationStatus = 'pending';
            existingLicense.rejectionReason = '';
            existingLicense.verifiedBy = null;
            existingLicense.verifiedAt = null;
            await existingLicense.save();

            return Helper.response("Success", "License re-submitted for verification", {
                licenseId: existingLicense._id,
                status: 'pending'
            }, res, 200);
        }

        // Create new license entry (photos only)
        const newLicense = new DriverLicense({
            userId,
            licenseFrontPhoto: frontUpload.secure_url,
            licenseBackPhoto: backUpload.secure_url,
            verificationStatus: 'pending'
        });

        const savedLicense = await newLicense.save();

        Helper.response("Success", "License submitted for verification", {
            licenseId: savedLicense._id,
            status: 'pending'
        }, res, 201);

    } catch (error) {
        console.error('Submit license error:', error);
        if (error.code === 11000) {
            return Helper.response("Failed", "This license number is already registered", {}, res, 400);
        }
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// USER: Get KYC / license verification status
// ============================================
LicenseController.getLicenseStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        const license = await DriverLicense.findOne({ userId })
            .select('-__v');

        if (!license) {
            return Helper.response("Success", "No license submitted", {
                kycStatus: 'not_submitted',
                license: null
            }, res, 200);
        }

        Helper.response("Success", "License status retrieved", {
            kycStatus: license.verificationStatus,
            license: {
                _id: license._id,
                licenseNumber: license.licenseNumber,
                licenseType: license.licenseType,
                fullName: license.fullName,
                issueDate: license.issueDate,
                expiryDate: license.expiryDate,
                issuingAuthority: license.issuingAuthority,
                licenseFrontPhoto: license.licenseFrontPhoto,
                licenseBackPhoto: license.licenseBackPhoto,
                verificationStatus: license.verificationStatus,
                rejectionReason: license.rejectionReason,
                verifiedAt: license.verifiedAt,
                createdAt: license.createdAt,
                updatedAt: license.updatedAt
            }
        }, res, 200);

    } catch (error) {
        console.error('Get license status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = LicenseController;
