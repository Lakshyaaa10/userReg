const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

// ✅ v5.x - instance-based initialization
const cashfree = new Cashfree(
    process.env.CASHFREE_ENV === 'PRODUCTION'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX,
    process.env.CASHFREE_APP_ID,
    process.env.CASHFREE_SECRET_KEY
);



const PaymentController = {};

PaymentController.createOrder = async (req, res) => {
    console.log('[Cashfree] APP_ID:', process.env.CASHFREE_APP_ID ? 'SET ✓' : 'MISSING ✗');
console.log('[Cashfree] SECRET:', process.env.CASHFREE_SECRET_KEY ? 'SET ✓' : 'MISSING ✗');
console.log('[Cashfree] ENV:', process.env.CASHFREE_ENV || 'SANDBOX (default)');
    try {
        const {
            amount, currency = 'INR', bookingId,
            customerId, customerPhone, customerEmail, customerName
        } = req.body;

        if (!amount) return Helper.response("Failed", "Amount is required", {}, res, 400);
        if (!bookingId) return Helper.response("Failed", "Booking ID is required", {}, res, 400);

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
            order_tags: { bookingId: String(bookingId) }
        };

        if (orderRequest.customer_details.customer_phone.length < 10)
            return Helper.response("Failed", "Invalid Phone Number", {}, res, 400);
        if (!orderRequest.customer_details.customer_email.includes('@'))
            return Helper.response("Failed", "Invalid Email", {}, res, 400);

        // ✅ Called on instance, no API version string
        const response = await cashfree.PGCreateOrder(orderRequest);
        const order = response.data;

        Helper.response("Success", "Order created successfully", {
            order_id: order.order_id,
            payment_session_id: order.payment_session_id
        }, res, 200);

    } catch (error) {
        console.error('[Payment] Create order error:', error?.response?.data || error.message);
        Helper.response("Failed", error?.response?.data?.message || "Order creation failed",
            error?.response?.data || error.message, res, 500);
    }
};

PaymentController.verifyPayment = async (req, res) => {
    try {
        const { orderId, bookingId } = req.body;

        if (!orderId || !bookingId)
            return Helper.response("Failed", "Missing required fields", {}, res, 400);

        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking)
            return Helper.response("Failed", "Booking not found", {}, res, 404);

        if (existingBooking.paymentStatus === 'paid')
            return Helper.response("Success", "Payment already verified", {
                booking: existingBooking, alreadyVerified: true
            }, res, 200);

        // ✅ Called on instance
        const response = await cashfree.PGOrderFetchPayments(orderId);
        const payments = response.data;
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (successfulPayment) {
            existingBooking.paymentStatus = 'paid';
            existingBooking.paymentId = successfulPayment.cf_payment_id;
            existingBooking.cashfreeOrderId = orderId;
            existingBooking.bookingStatus = 'confirmed';
            await existingBooking.save();

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
            return Helper.response("Failed", "Payment not successful", { status: 'failed' }, res, 400);
        }

    } catch (error) {
        console.error('[Payment] Verify error:', error?.response?.data || error.message);
        Helper.response("Failed", "Verification failed", error.message, res, 500);
    }
};

PaymentController.refundPayment = async (req, res) => {
    try {
        const { bookingId, amount } = req.body;
        const booking = await Booking.findById(bookingId);

        if (!booking) return Helper.response("Failed", "Booking not found", {}, res, 404);
        if (!booking.cashfreeOrderId) return Helper.response("Failed", "No Order ID found", {}, res, 400);

        const refundRequest = {
            refund_amount: parseFloat(amount),
            refund_id: `refund_${bookingId}_${Date.now()}`,
            refund_note: "User requested cancellation"
        };

        // ✅ Called on instance
        const response = await cashfree.PGOrderCreateRefund(booking.cashfreeOrderId, refundRequest);

        booking.paymentStatus = 'refunded';
        await booking.save();

        Helper.response("Success", "Refund initiated successfully", { refund: response.data }, res, 200);

    } catch (error) {
        console.error('[Payment] Refund error:', error?.response?.data || error.message);
        Helper.response("Failed", "Refund failed", error.message, res, 500);
    }
};

PaymentController.handleWebhook = async (req, res) => {
    try {
        console.log('[Payment] Webhook received:', req.body);
        if (req.body?.type === 'PAYMENT_SUCCESS_WEBHOOK') {
            console.log('[Payment] Webhook: Payment Success');
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Payment] Webhook error:', error);
        res.status(500).send('Webhook Error');
    }
};

module.exports = PaymentController;