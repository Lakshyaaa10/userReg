const express = require('express');
const paymentRouter = express.Router();
const PaymentController = require('../controller/PaymentController');

// Initialize payment
paymentRouter.post('/initialize', (req, res, next) => {
    PaymentController.initializePayment(req, res, next);
});

// Verify payment
paymentRouter.post('/verify', (req, res, next) => {
    PaymentController.verifyPayment(req, res, next);
});

// Get payment history
paymentRouter.get('/history', (req, res, next) => {
    PaymentController.getPaymentHistory(req, res, next);
});

// Refund payment
paymentRouter.post('/refund', (req, res, next) => {
    PaymentController.refundPayment(req, res, next);
});

module.exports = paymentRouter;
