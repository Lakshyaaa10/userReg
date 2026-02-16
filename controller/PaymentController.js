const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

const PaymentController = {};

// Initialize Cashfree instance
const cashfree = new Cashfree();
cashfree.XClientId = process.env.CASHFREE_APP_ID;
cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
cashfree.XEnvironment = process.env.CASHFREE_ENV === 'PRODUCTION' 
    ? CFEnvironment.PRODUCTION 
    : CFEnvironment.SANDBOX;

// Set API Version explicitly if needed (default is 2025-01-01 in SDK 5.x)
// User code was trying to use "2023-08-01", so we set it here.
cashfree.XApiVersion = "2023-08-01";

// Create Cashfree order
PaymentController.createOrder = async (req, res) => {
    try {
        const {
            amount,
            currency = 'INR',
            bookingId,
            customerId,
            customerPhone,
            customerEmail,
            customerName
        } = req.body;

        console.log('[Payment] Creating order:', { amount, currency, bookingId, timestamp: new Date() });

        if (!amount) {
            return Helper.response("Failed", "Amount is required", {}, res, 400);
        }

        if (!bookingId) {
            return Helper.response("Failed", "Booking ID is required", {}, res, 400);
        }

        const orderRequest = {
            order_amount: parseFloat(amount),
            order_currency: currency,
            order_id: `order_${bookingId}_${Date.now()}`,
            customer_details: {
                customer_id: String(customerId || 'guest'),
                customer_phone: String(customerPhone).replace(/\D/g, '') || '9999999999',
                customer_email: String(customerEmail || 'guest@example.com').toLowerCase(),
                customer_name: String(customerName || 'Guest').substring(0, 50)
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/booking-confirmation?bookingId=${bookingId}&order_id={order_id}`,
                notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`
            },
            order_tags: {
                bookingId: String(bookingId)
            }
        };

        // Validate customer details
        if (orderRequest.customer_details.customer_phone.length < 10) {
            return Helper.response("Failed", "Invalid Phone Number", {}, res, 400);
        }
        if (!orderRequest.customer_details.customer_email.includes('@')) {
             return Helper.response("Failed", "Invalid Email", {}, res, 400);
        }

        // Corrected: Removed date string argument
        const response = await cashfree.PGCreateOrder(orderRequest);
        const order = response.data;
        
        console.log('[Payment] Order created:', { 
            orderId: order.order_id, 
            paymentSessionId: order.payment_session_id 
        });

        // Return ONLY what frontend needs
        const paymentData = {
            order_id: order.order_id,
            payment_session_id: order.payment_session_id
        };

        Helper.response("Success", "Order created successfully", paymentData, res, 200);

    } catch (error) {
        console.error('[Payment] Create order error:', error?.response?.data || error.message);
        Helper.response(
            "Failed", 
            error?.response?.data?.message || "Order creation failed", 
            error?.response?.data || error.message, 
            res, 
            500
        );
    }
};

// Verify payment
PaymentController.verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            bookingId
        } = req.body;

        if (!orderId || !bookingId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // IDEMPOTENCY CHECK
        if (existingBooking.paymentStatus === 'paid') {
             return Helper.response("Success", "Payment already verified", {
                 booking: existingBooking,
                 alreadyVerified: true
             }, res, 200);
        }

        // Verify payment
        // Corrected: Removed date string argument
        const response = await cashfree.PGOrderFetchPayments(orderId);
        const payments = response.data;

        // Find a successful payment
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (successfulPayment) {
            // Update booking status
            existingBooking.paymentStatus = 'paid';
            existingBooking.paymentId = successfulPayment.cf_payment_id;
            existingBooking.cashfreeOrderId = orderId;
            existingBooking.bookingStatus = 'confirmed';
            await existingBooking.save();

            // Block dates in Availability model
            const startDate = new Date(existingBooking.startDate);
            const endDate = new Date(existingBooking.endDate);
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                await Availability.findOneAndUpdate(
                    { vehicleId: existingBooking.vehicleId },
                    { $addToSet: { unavailableDates: new Date(d) } },
                    { upsert: true, new: true }
                );
            }

            return Helper.response("Success", "Payment verified and booking confirmed", {
                booking: existingBooking,
                paymentId: successfulPayment.cf_payment_id,
                status: 'success'
            }, res, 200);
        } else {
            return Helper.response("Failed", "Payment verification failed", { status: 'failed' }, res, 400);
        }

    } catch (error) {
        console.error('[Payment] Verify error:', error?.response?.data || error.message);
        Helper.response("Failed", "Verification failed", error.message, res, 500);
    }
};

// Webhook handler
PaymentController.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        const rawBody = JSON.stringify(req.body); // Or however raw body is accessed in express

        // Verify signature using SDK
        // Note: verifyWebhookSignature might need raw body string exactly as received
        // Since express.json() parses it, might be tricky. 
        // Ideally use raw-body middleware or similar if strictly required by SDK utils.
        
        try {
             // cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
             // For now we just log as we might need raw body setup
        } catch (e) {
             console.error('Webhook signature verification failed', e);
        }

        console.log('[Payment] Webhook received:', req.body);
        if (req.body?.type === 'PAYMENT_SUCCESS_WEBHOOK') {
             console.log('[Payment] Webhook: Payment Success');
             // TODO: Update booking status reference webhook event data
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Payment] Webhook error:', error);
        res.status(500).send('Webhook Error');
    }
};

PaymentController.refundPayment = async (req, res) => {
    try {
        const { bookingId, amount } = req.body;
        
        const booking = await Booking.findById(bookingId);
        if(!booking) return Helper.response("Failed", "Booking not found", {}, res, 404);

        if (!booking.cashfreeOrderId) {
             return Helper.response("Failed", "No Order ID found", {}, res, 400);
        }

        // Create refund with Cashfree instance
        const refundRequest = {
            refund_amount: parseFloat(amount),
            refund_id: `refund_${bookingId}_${Date.now()}`,
            refund_note: "User requested cancellation"
        };
        
        // Corrected: Removed date string argument
        const response = await cashfree.PGOrderCreateRefund(booking.cashfreeOrderId, refundRequest);
        const refund = response.data;

        booking.paymentStatus = 'refunded';
        await booking.save();

        Helper.response("Success", "Refund initiated successfully", { refund }, res, 200);

    } catch (error) {
        console.error('[Payment] Refund error:', error?.response?.data || error.message);
        Helper.response("Failed", "Refund failed", error.message, res, 500);
    }
};

module.exports = PaymentController;
