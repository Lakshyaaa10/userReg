const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    // The entity being reviewed (Host/Owner ID)
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users', // Linking to the User (Host/Owner)
        required: true
    },
    // Optional: Review specific booking if needed
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: false
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    },
    photos: [{
        type: String // URLs of uploaded photos
    }],
    helpful: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent multiple reviews from same user for same target? 
// Maybe allowed multiple times if different bookings? keeping it flexible for now.

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;
