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

// Get bookings for a specific renter
bookingRouter.get('/renter/:renterId', (req, res, next) => {
    BookingController.getRenterBookings(req, res, next);
});

// Get bookings for a specific owner
bookingRouter.get('/owner/:ownerId', (req, res, next) => {
    BookingController.getOwnerBookings(req, res, next);
});

// Cancel booking
bookingRouter.post('/cancel', (req, res, next) => {
    BookingController.cancelBooking(req, res, next);
});

// Get booking by ID (must be last to avoid route conflicts)
bookingRouter.get('/:bookingId', (req, res, next) => {
    BookingController.getBookingById(req, res, next);
});

module.exports = bookingRouter;
