const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const User = require('../Models/userModel');
const Register = require('../Models/RegisterModel');
const Availability = require('../Models/AvailabilityModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const PaymentController = {};

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S2qqGKFsiIoeZL',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'xQ4RujNZEugY76UxgfP9fBB2'
});

// Create Razorpay order
PaymentController.createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, bookingId } = req.body;

        console.log('[Payment] Creating order:', { amount, currency, receipt, bookingId, timestamp: new Date() });

        if (!amount) {
            console.error('[Payment] Order creation failed: Amount is required');
            return Helper.response("Failed", "Amount is required", {}, res, 400);
        }

        // Create Razorpay order with enhanced options
        const options = {
            amount: amount * 100, // Convert to paise
            currency: currency,
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1, // Auto capture payment
            notes: {
                bookingId: bookingId || 'pending',
                timestamp: new Date().toISOString()
            }
        };

        const order = await razorpay.orders.create(options);
        console.log('[Payment] Order created successfully:', { orderId: order.id, amount: order.amount });

        Helper.response("Success", "Order created successfully", { order }, res, 200);

    } catch (error) {
        console.error('[Payment] Create order error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Verify payment with idempotency
PaymentController.verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            paymentId,
            signature,
            bookingId,
            amount
        } = req.body;

        console.log('[Payment] Verification attempt:', { orderId, paymentId, bookingId, amount, timestamp: new Date() });

        if (!orderId || !paymentId || !signature || !bookingId) {
            console.error('[Payment] Verification failed: Missing required fields');
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // IDEMPOTENCY CHECK: Check if payment already verified
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            console.error('[Payment] Verification failed: Booking not found:', bookingId);
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        if (existingBooking.paymentStatus === 'paid' && existingBooking.paymentId === paymentId) {
            console.log('[Payment] Payment already verified (idempotent):', { bookingId, paymentId });
            return Helper.response("Success", "Payment already verified", {
                booking: existingBooking,
                paymentId,
                amount,
                alreadyVerified: true
            }, res, 200);
        }

        // Verify signature
        const text = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'xQ4RujNZEugY76UxgfP9fBB2')
            .update(text.toString())
            .digest("hex");

        const isPaymentValid = expectedSignature === signature;

        console.log('[Payment] Signature verification:', {
            isValid: isPaymentValid,
            orderId,
            paymentId
        });

        if (isPaymentValid) {
            // Update booking status
            const booking = await Booking.findByIdAndUpdate(
                bookingId,
                {
                    status: 'confirmed',
                    paymentId: paymentId,
                    paymentStatus: 'paid',
                    paymentMethod: 'Online',
                    paymentDate: new Date(),
                    razorpayOrderId: orderId
                },
                { new: true }
            );

            console.log('[Payment] Payment verified and booking updated:', { bookingId, paymentId, status: booking.status });

            Helper.response("Success", "Payment verified successfully", {
                booking,
                paymentId,
                amount
            }, res, 200);
        } else {
            console.error('[Payment] Verification failed: Invalid signature', { orderId, paymentId });
            Helper.response("Failed", "Payment verification failed - Invalid signature", {}, res, 400);
        }

    } catch (error) {
        console.error('[Payment] Verify payment error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get payment status
PaymentController.getPaymentStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return Helper.response("Failed", "Booking ID is required", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId)
            .select('status paymentStatus paymentId paymentDate totalAmount');

        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        Helper.response("Success", "Payment status retrieved successfully", {
            bookingId,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            paymentId: booking.paymentId,
            paymentDate: booking.paymentDate,
            totalAmount: booking.totalAmount
        }, res, 200);

    } catch (error) {
        console.error('Get payment status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Refund payment
PaymentController.refundPayment = async (req, res) => {
    try {
        const { bookingId, amount, reason } = req.body;

        if (!bookingId || !amount) {
            return Helper.response("Failed", "Booking ID and amount are required", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        if (booking.paymentStatus !== 'paid') {
            return Helper.response("Failed", "Payment not completed", {}, res, 400);
        }

        // Create refund with Razorpay
        const refund = await razorpay.payments.refund(booking.paymentId, {
            amount: amount * 100, // Convert to paise
            notes: {
                reason: reason || 'Customer request',
                bookingId: bookingId
            }
        });

        // Update booking status
        await Booking.findByIdAndUpdate(bookingId, {
            status: 'cancelled',
            paymentStatus: 'refunded',
            refundId: refund.id,
            refundDate: new Date()
        });

        Helper.response("Success", "Refund processed successfully", { refund }, res, 200);

    } catch (error) {
        console.error('Refund payment error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get user details for payment
PaymentController.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return Helper.response("Failed", "User ID is required", {}, res, 400);
        }

        const user = await User.findById(userId)
            .select('name email contact phone address city state pincode');

        if (!user) {
            return Helper.response("Failed", "User not found", {}, res, 404);
        }

        Helper.response("Success", "User details retrieved successfully", { user }, res, 200);

    } catch (error) {
        console.error('Get user details error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Create offline payment booking
PaymentController.createOfflineBooking = async (req, res) => {
    try {
        const {
            renterId,
            renterName,
            renterPhone,
            renterEmail,
            vehicleId,
            startDate,
            endDate,
            totalDays,
            pricePerDay,
            totalAmount,
            pickupLocation,
            dropoffLocation
        } = req.body;

        // Validate required fields
        if (!renterId || !vehicleId || !startDate || !endDate || !totalDays || !pricePerDay || !totalAmount) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Verify vehicle exists and get owner details from RegisteredVehicles
        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const vehicle = await RegisteredVehicles.findById(vehicleId)
            .populate('registerId', 'Name ContactNo')
            .populate('rentalId', 'ownerName ContactNo');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Get owner details from registerId or rentalId
        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const ownerName = register.Name || rental.ownerName || 'Unknown Owner';
        const ownerPhone = register.ContactNo || rental.ContactNo || 'N/A';

        // Get owner user details from User model
        const owner = await User.findById(vehicle.userId);
        if (!owner) {
            return Helper.response("Failed", "Vehicle owner not found", {}, res, 404);
        }

        // Create booking with all required fields  
        const booking = new Booking({
            renterId,
            renterName,
            renterPhone,
            renterEmail,
            vehicleId,
            ownerId: vehicle.userId, // Use ownerId as required by schema
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            vehicleModel: vehicle.vehicleModel || 'Unknown Model',
            vehicleType: vehicle.vehicleType || 'bike',
            vehiclePhoto: vehicle.vehiclePhoto || '',
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalDays: parseInt(totalDays),
            pricePerDay: parseFloat(pricePerDay),
            totalAmount: parseFloat(totalAmount),
            status: 'pending', // Use valid enum value
            paymentStatus: 'pending',
            paymentMethod: 'offline',
            pickupLocation: pickupLocation || 'To be determined',
            dropoffLocation: dropoffLocation || 'To be determined',
            createdAt: new Date()
        });

        await booking.save();

        // Mark dates as unavailable in Availability collection
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            await Availability.findOneAndUpdate(
                {
                    vehicleId: vehicleId,
                    date: d
                },
                {
                    vehicleId: vehicleId,
                    ownerId: vehicle.userId,
                    date: d,
                    isAvailable: false,
                    reason: 'booked'
                },
                { upsert: true, new: true }
            );
        }

        Helper.response("Success", "Offline booking created successfully", {
            bookingId: booking._id,
            booking
        }, res, 201);

    } catch (error) {
        console.error('Create offline booking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update booking status
PaymentController.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId, status, paymentId, paymentStatus } = req.body;

        if (!bookingId || !status) {
            return Helper.response("Failed", "Booking ID and status are required", {}, res, 400);
        }

        const updateData = { status };
        if (paymentId) updateData.paymentId = paymentId;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (status === 'accepted') updateData.acceptedAt = new Date();

        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            updateData,
            { new: true }
        );

        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        Helper.response("Success", "Booking status updated successfully", { booking }, res, 200);

    } catch (error) {
        console.error('Update booking status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Webhook handler for Razorpay payment events
PaymentController.handleWebhook = async (req, res) => {
    try {
        const webhookSignature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        console.log('[Webhook] Received payment webhook:', {
            event: req.body.event,
            timestamp: new Date()
        });

        if (!webhookSecret) {
            console.error('[Webhook] Webhook secret not configured');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (expectedSignature !== webhookSignature) {
            console.error('[Webhook] Invalid signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        console.log('[Webhook] Processing event:', event);

        // Handle payment captured event
        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            const orderId = payment.order_id;
            const paymentId = payment.id;

            console.log('[Webhook] Payment captured:', { orderId, paymentId, amount: payment.amount });

            // Find and update booking by order ID
            const booking = await Booking.findOneAndUpdate(
                { razorpayOrderId: orderId },
                {
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paymentId: paymentId,
                    paymentMethod: 'Online',
                    paymentDate: new Date()
                },
                { new: true }
            );

            if (booking) {
                console.log('[Webhook] Booking updated via webhook:', { bookingId: booking._id });
            } else {
                console.warn('[Webhook] No booking found for order:', orderId);
            }
        }

        // Handle payment failed event
        if (event === 'payment.failed') {
            const payment = payload.payment.entity;
            const orderId = payment.order_id;

            console.log('[Webhook] Payment failed:', { orderId });

            await Booking.findOneAndUpdate(
                { razorpayOrderId: orderId },
                {
                    paymentStatus: 'failed',
                    status: 'cancelled'
                }
            );
        }

        res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

module.exports = PaymentController;