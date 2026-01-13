const express = require('express');
const paymentRouter = express.Router();
const PaymentController = require('../controller/PaymentController');

// Create Razorpay order
paymentRouter.post('/create-order', (req, res, next) => {
    PaymentController.createOrder(req, res, next);
});

// Verify payment
paymentRouter.post('/verify', (req, res, next) => {
    PaymentController.verifyPayment(req, res, next);
});

// Get payment status
paymentRouter.get('/status/:bookingId', (req, res, next) => {
    PaymentController.getPaymentStatus(req, res, next);
});

// Refund payment
paymentRouter.post('/refund', (req, res, next) => {
    PaymentController.refundPayment(req, res, next);
});

// Get user details
paymentRouter.get('/user/:userId', (req, res, next) => {
    PaymentController.getUserDetails(req, res, next);
});

// Create offline booking
paymentRouter.post('/offline-booking', (req, res, next) => {
    PaymentController.createOfflineBooking(req, res, next);
});

// Update booking status
paymentRouter.post('/update-status', (req, res, next) => {
    PaymentController.updateBookingStatus(req, res, next);
});

// Razorpay webhook (IMPORTANT: Must be before other routes)
paymentRouter.post('/webhook', (req, res, next) => {
    PaymentController.handleWebhook(req, res, next);
});

module.exports = paymentRouter;
