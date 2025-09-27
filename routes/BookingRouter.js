const express = require('express');
const bookingRouter = express.Router();
const BookingController = require('../controller/BookingController');

// Create a new booking request
bookingRouter.post('/create', (req, res, next) => {
    BookingController.createBooking(req, res, next);
});

// Get bookings for a user (renter or owner)
bookingRouter.get('/user', (req, res, next) => {
    BookingController.getUserBookings(req, res, next);
});

// Update booking status (accept/reject)
bookingRouter.put('/status', (req, res, next) => {
    BookingController.updateBookingStatus(req, res, next);
});

// Complete booking
bookingRouter.put('/complete', (req, res, next) => {
    BookingController.completeBooking(req, res, next);
});

module.exports = bookingRouter;
