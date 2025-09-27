const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Notification = require('../Models/NotificationModel');

const PaymentController = {};

// Initialize payment (Razorpay integration)
PaymentController.initializePayment = async (req, res) => {
    try {
        const { bookingId, amount, currency = 'INR' } = req.body;

        if (!bookingId || !amount) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Generate Razorpay order
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `booking_${bookingId}`,
            notes: {
                bookingId: bookingId,
                renterId: booking.renterId,
                ownerId: booking.ownerId
            }
        };

        const order = await razorpay.orders.create(options);

        // Update booking with payment details
        booking.paymentId = order.id;
        await booking.save();

        Helper.response("Success", "Payment initialized successfully", {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        }, res, 200);

    } catch (error) {
        console.error('Initialize payment error:', error);
        Helper.response("Failed", "Payment initialization failed", error.message, res, 500);
    }
};

// Verify payment
PaymentController.verifyPayment = async (req, res) => {
    try {
        const { bookingId, paymentId, signature } = req.body;

        if (!bookingId || !paymentId || !signature) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Verify Razorpay signature
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${bookingId}|${paymentId}`)
            .digest('hex');

        if (signature !== expectedSignature) {
            return Helper.response("Failed", "Invalid payment signature", {}, res, 400);
        }

        // Update booking payment status
        booking.paymentStatus = 'paid';
        booking.paymentMethod = 'razorpay';
        await booking.save();

        // Create success notification
        const notification = new Notification({
            userId: booking.renterId,
            title: "Payment Successful",
            message: `Payment of ₹${booking.totalAmount} for ${booking.vehicleModel} has been processed successfully`,
            type: "payment_success",
            relatedId: bookingId,
            relatedType: "payment"
        });
        await notification.save();

        // Create notification for owner
        const ownerNotification = new Notification({
            userId: booking.ownerId,
            title: "Payment Received",
            message: `Payment of ₹${booking.totalAmount} has been received for your ${booking.vehicleModel}`,
            type: "payment_success",
            relatedId: bookingId,
            relatedType: "payment"
        });
        await ownerNotification.save();

        Helper.response("Success", "Payment verified successfully", { booking }, res, 200);

    } catch (error) {
        console.error('Verify payment error:', error);
        Helper.response("Failed", "Payment verification failed", error.message, res, 500);
    }
};

// Get payment history
PaymentController.getPaymentHistory = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        const payments = await Booking.find({
            $or: [{ renterId: userId }, { ownerId: userId }],
            paymentStatus: 'paid'
        })
        .select('vehicleModel totalAmount paymentStatus createdAt startDate endDate')
        .sort({ createdAt: -1 });

        Helper.response("Success", "Payment history retrieved successfully", payments, res, 200);

    } catch (error) {
        console.error('Get payment history error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Refund payment
PaymentController.refundPayment = async (req, res) => {
    try {
        const { bookingId, reason } = req.body;

        if (!bookingId) {
            return Helper.response("Failed", "Missing bookingId", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        if (booking.paymentStatus !== 'paid') {
            return Helper.response("Failed", "No payment to refund", {}, res, 400);
        }

        // Process Razorpay refund
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const refund = await razorpay.payments.refund(booking.paymentId, {
            amount: booking.totalAmount * 100, // Convert to paise
            notes: {
                reason: reason || 'Booking cancellation'
            }
        });

        // Update booking status
        booking.paymentStatus = 'refunded';
        booking.status = 'cancelled';
        await booking.save();

        // Create notification
        const notification = new Notification({
            userId: booking.renterId,
            title: "Refund Processed",
            message: `Refund of ₹${booking.totalAmount} has been processed for your booking`,
            type: "payment_success",
            relatedId: bookingId,
            relatedType: "payment"
        });
        await notification.save();

        Helper.response("Success", "Refund processed successfully", { refund }, res, 200);

    } catch (error) {
        console.error('Refund payment error:', error);
        Helper.response("Failed", "Refund processing failed", error.message, res, 500);
    }
};

module.exports = PaymentController;
