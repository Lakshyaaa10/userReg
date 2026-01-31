const Helper = require("../Helper/Helper");
const registerRental = require("../Models/RegisterRentalModel");
const Users = require("../Models/userModel");

const RentalController = {};

// Get Rental Profile by User ID
RentalController.getRentalProfile = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware

        if (!userId) {
            return Helper.response("Failed", "Unauthorized", {}, res, 401);
        }

        const rentalProfile = await registerRental.findOne({ userId: userId });

        if (!rentalProfile) {
            return Helper.response("Failed", "Rental profile not found", {}, res, 404);
        }

        Helper.response("Success", "Rental profile retrieved", rentalProfile, res, 200);

    } catch (error) {
        console.error('Get rental profile error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update Rental Profile
RentalController.updateRentalProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const body = req.body;

        if (!userId) {
            return Helper.response("Failed", "Unauthorized", {}, res, 401);
        }

        // Find existing profile
        const rentalProfile = await registerRental.findOne({ userId: userId });

        if (!rentalProfile) {
            return Helper.response("Failed", "Rental profile not found", {}, res, 404);
        }

        // Fields to update
        const updateData = {};
        if (body.businessName) updateData.businessName = body.businessName;
        if (body.ownerName) updateData.ownerName = body.ownerName;
        if (body.Address) updateData.Address = body.Address;
        if (body.Landmark) updateData.Landmark = body.Landmark;
        if (body.Pincode) updateData.Pincode = body.Pincode;
        if (body.City) updateData.City = body.City;
        if (body.State) updateData.State = body.State;
        if (body.ContactNo) updateData.ContactNo = body.ContactNo;
        // Handle coordinates update if provided
        if (body.latitude) updateData.latitude = body.latitude;
        if (body.longitude) updateData.longitude = body.longitude;

        // Handle image upload if provided
        if (req.files && req.files.rentalImage) {
            const upload = await Helper.uploadVehicle(req.files.rentalImage);
            if (upload) {
                updateData.rentalImage = upload;
            }
        }

        const updatedProfile = await registerRental.findByIdAndUpdate(
            rentalProfile._id,
            { ...updateData, updatedAt: Date.now() },
            { new: true }
        );

        Helper.response("Success", "Rental profile updated successfully", updatedProfile, res, 200);

    } catch (error) {
        console.error('Update rental profile error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = RentalController;
