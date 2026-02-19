const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const Notification = require('../Models/NotificationModel');
const RegisteredVehicles = require('../Models/RegisteredVehicles');
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

// ✅ Create offline/Cashfree booking from mobile app
PaymentController.createOfflineBooking = async (req, res) => {
    try {
        const {
            renterId, renterName, renterPhone, renterEmail,
            vehicleId, startDate, endDate,
            totalDays = 0, pricePerDay = 0, pricePerHour = 0,
            totalAmount,
            pickupLocation, dropoffLocation
        } = req.body;

        if (!renterId || !vehicleId || !startDate || !endDate || totalAmount === undefined) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Fetch vehicle to get owner info
        const vehicle = await RegisteredVehicles.findById(vehicleId)
            .populate('registerId', 'Name ContactNo')
            .populate('rentalId', 'ownerName ContactNo');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const ownerName = register.Name || rental.ownerName || 'N/A';
        const ownerPhone = register.ContactNo || rental.ContactNo || 'N/A';

        const newBooking = new Booking({
            renterId,
            renterName,
            renterPhone: renterPhone || 'N/A',
            renterEmail: renterEmail || 'N/A',
            ownerId: vehicle.userId,
            ownerName,
            ownerPhone,
            vehicleId,
            vehicleModel: vehicle.vehicleModel || 'Unknown',
            vehicleType: vehicle.vehicleType || 'Unknown',
            // vehiclePhoto is required in schema - use placeholder if missing
            vehiclePhoto: vehicle.vehiclePhoto || 'https://placehold.co/400x300?text=Vehicle',
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalDays: totalDays || 1,
            // pricePerDay is required in schema - use pricePerHour as fallback for hourly bookings
            pricePerDay: pricePerDay || pricePerHour || 0,
            totalAmount,
            pickupLocation: pickupLocation || 'To be determined',
            dropoffLocation: dropoffLocation || 'To be determined',
            status: 'pending',
            paymentStatus: 'pending'
        });

        const savedBooking = await newBooking.save();

        // Notify owner (non-fatal)
        try {
            const ownerNotification = new Notification({
                userId: vehicle.userId,
                title: "New Booking Request",
                message: `${renterName} wants to book your ${newBooking.vehicleModel}`,
                type: "booking_request",
                relatedId: savedBooking._id,
                relatedType: "booking"
            });
            await ownerNotification.save();
        } catch (notifErr) {
            console.error('[Payment] Notification error (non-fatal):', notifErr.message);
        }

        Helper.response("Success", "Booking created successfully", {
            bookingId: savedBooking._id
        }, res, 201);

    } catch (error) {
        console.error('[Payment] createOfflineBooking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ✅ Update booking status (called after payment success/cancel from mobile)
PaymentController.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId, status, paymentStatus } = req.body;

        if (!bookingId) {
            return Helper.response("Failed", "Missing bookingId", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        if (status) booking.status = status;
        if (paymentStatus) booking.paymentStatus = paymentStatus;
        await booking.save();

        Helper.response("Success", "Booking status updated", { booking }, res, 200);

    } catch (error) {
        console.error('[Payment] updateBookingStatus error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ✅ NEW: Get user details by userId
PaymentController.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const User = require('../Models/userModel');
        const user = await User.findById(userId).select('-password');
        if (!user) return Helper.response("Failed", "User not found", {}, res, 404);
        Helper.response("Success", "User details fetched", user, res, 200);
    } catch (error) {
        console.error('[Payment] getUserDetails error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ✅ Get payment status for a booking
PaymentController.getPaymentStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!bookingId) return Helper.response("Failed", "Missing bookingId", {}, res, 400);

        const booking = await Booking.findById(bookingId);
        if (!booking) return Helper.response("Failed", "Booking not found", {}, res, 404);

        Helper.response("Success", "Payment status fetched", {
            bookingId: booking._id,
            paymentStatus: booking.paymentStatus,
            status: booking.status,
            totalAmount: booking.totalAmount,
            paymentId: booking.paymentId || null
        }, res, 200);

    } catch (error) {
        console.error('[Payment] getPaymentStatus error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = PaymentController;