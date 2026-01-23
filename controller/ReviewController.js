const Review = require('../Models/ReviewModel');
const Register = require('../Models/RegisterModel');
const RegisteredVehicles = require('../Models/RegisteredVehicles');
const RegisterRental = require('../Models/RegisterRentalModel');
const Helper = require('../Helper/Helper');
const mongoose = require('mongoose');

const ReviewController = {};

// Add a new review
ReviewController.addReview = async (req, res) => {
    try {
        const { targetId, rating, comment, photos, bookingId } = req.body;
        const reviewerId = req.user.id; // From middleware

        if (!targetId || !rating || !comment) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const newReview = new Review({
            reviewerId,
            targetId,
            rating,
            comment,
            photos: photos || [],
            bookingId
        });

        await newReview.save();

        Helper.response("Success", "Review added successfully", newReview, res, 201);
    } catch (error) {
        console.error("Add Review Error:", error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get reviews for a specific host/target
ReviewController.getHostReviews = async (req, res) => {
    try {
        const { targetId } = req.params;

        const reviews = await Review.find({ targetId })
            .populate('reviewerId', 'username photo') // Assuming User model has these
            .sort({ createdAt: -1 });

        // Calculate stats
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0
            ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)
            : 0;

        const stats = {
            1: reviews.filter(r => r.rating === 1).length,
            2: reviews.filter(r => r.rating === 2).length,
            3: reviews.filter(r => r.rating === 3).length,
            4: reviews.filter(r => r.rating === 4).length,
            5: reviews.filter(r => r.rating === 5).length,
            total: totalReviews,
            average: avgRating
        };

        Helper.response("Success", "Reviews fetched successfully", { reviews, stats }, res, 200);
    } catch (error) {
        console.error("Get Reviews Error:", error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get Public Host Profile (Aggregated Info)
ReviewController.getHostProfile = async (req, res) => {
    try {
        const { hostId } = req.params; // This matches the RegisterModel _id or UserId

        // 1. Fetch Owner Profile (RegisterModel or RegisterRentalModel?)
        // Assuming hostId is linked to userId. 
        // We need to find the Register document associated with this userId
        let ownerProfile = await Register.findOne({ userId: hostId });
        let rentalProfile = null;

        if (!ownerProfile) {
            // Check if it's a rental business owner?
            // Actually, RegisterModel usually holds the personal details. 
            // RegisterRental holds business details.
            rentalProfile = await RegisterRental.findOne({ userId: hostId });
            if (!rentalProfile) {
                return Helper.response("Failed", "Host not found", {}, res, 404);
            }
        } else {
            rentalProfile = await RegisterRental.findOne({ userId: hostId });
        }

        // 2. Fetch Owner's Vehicles
        const vehicles = await RegisteredVehicles.find({ userId: hostId })
            .select('vehicleModel vehicleType vehiclePhoto licensePlate rentalPrice hourlyPrice verificationStatus')
            .where('verificationStatus').equals('verified'); // Only show verified vehicles

        // 3. Fetch Reviews Stats (Re-using logic or calling internal function if needed)
        // Note: targetId for reviews should match the 'Register' _id usually. 
        // But for simplicity let's assume targetId IS the hostId (userId) for now 
        // so reviews stick to the User Account not just one Profile doc.
        // Wait, earlier I defined targetId as ref to 'Register'. 
        // Let's use the userId as the common identifier if possible.
        // Actually, let's treat targetId as the userId to be consistent. 

        const reviews = await Review.find({ targetId: hostId }); // Querying by userId
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0
            ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)
            : 0;

        const profileData = {
            owner: ownerProfile || rentalProfile, // Fallback
            isRentalBusiness: !!rentalProfile,
            businessDetails: rentalProfile,
            vehicles: vehicles,
            stats: {
                totalReviews,
                averageRating: avgRating,
                joinedAt: ownerProfile ? ownerProfile.createdAt : (rentalProfile ? rentalProfile.createdAt : null)
            }
        };

        Helper.response("Success", "Host Profile fetched successfully", profileData, res, 200);

    } catch (error) {
        console.error("Get Host Profile Error:", error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = ReviewController;
