const mongoose = require('mongoose');
const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const Notification = require('../Models/NotificationModel');
const RegisteredVehicles = require('../Models/RegisteredVehicles');
const PendingBookingPayment = require('../Models/PendingBookingPaymentModel');
const CouponController = require('./CouponController');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { sendBookingLifecycleEmails } = require('../helpers/bookingEmailService');

// ✅ v5.x - instance-based initialization
 const cashfree = new Cashfree(
    process.env.CASHFREE_ENV === 'PRODUCTION'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX,
    process.env.CASHFREE_APP_ID,
    process.env.CASHFREE_SECRET_KEY
);

const PaymentController = {};

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.zugo.co.in').replace(/\/$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'https://api.zugo.co.in').replace(/\/$/, '');

function normalizeVehicleIdList(ids) {
    const seen = new Set();
    const normalized = [];
    for (const id of ids || []) {
        if (!id) continue;
        const key = id.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(id);
    }
    return normalized;
}

function getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

async function resolveBookingVehicleByAnyId(vehicleId) {
    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
        return null;
    }

    const directVehicle = await RegisteredVehicles.findOne({
        _id: vehicleId,
        verificationStatus: 'verified'
    })
        .populate('registerId', 'Name ContactNo')
        .populate('rentalId', 'ownerName ContactNo');

    if (directVehicle) {
        return {
            vehicle: directVehicle,
            requestedVehicleId: vehicleId,
            resolvedVehicleId: directVehicle._id,
            bookingVehicleIds: [directVehicle._id],
            additionalVehicle: null
        };
    }

    const parentVehicle = await RegisteredVehicles.findOne({
        verificationStatus: 'verified',
        'additionalVehicles._id': vehicleId
    })
        .populate('registerId', 'Name ContactNo')
        .populate('rentalId', 'ownerName ContactNo');

    if (!parentVehicle) {
        return null;
    }

    const additionalVehicle = parentVehicle.additionalVehicles?.find(
        (subVehicle) => subVehicle?._id?.toString() === vehicleId.toString()
    );

    if (!additionalVehicle) {
        return null;
    }

    return {
        vehicle: parentVehicle,
        requestedVehicleId: vehicleId,
        resolvedVehicleId: parentVehicle._id,
        bookingVehicleIds: normalizeVehicleIdList([vehicleId, parentVehicle._id]),
        additionalVehicle
    };
}

async function assertVehicleAvailable(bookingVehicleIds, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStart = getStartOfDay(d);
        const dayEnd = getEndOfDay(d);

        const availability = await Availability.findOne({
            vehicleId: { $in: bookingVehicleIds },
            date: { $gte: dayStart, $lte: dayEnd },
            isAvailable: false
        });

        if (availability) {
            throw new Error(`Vehicle not available on ${d.toDateString()}`);
        }

        const activeBooking = await Booking.findOne({
            vehicleId: { $in: bookingVehicleIds },
            status: { $in: ['pending', 'accepted', 'confirmed', 'in_progress'] },
            startDate: { $lte: dayEnd },
            endDate: { $gte: dayStart }
        }).select('_id');

        if (activeBooking) {
            throw new Error(`Vehicle already booked on ${d.toDateString()}`);
        }
    }
}

async function markBookingDatesUnavailable(booking) {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        await Availability.findOneAndUpdate(
            { vehicleId: booking.vehicleId, date: new Date(d) },
            {
                vehicleId: booking.vehicleId,
                ownerId: booking.ownerId,
                date: new Date(d),
                isAvailable: false,
                reason: 'booked'
            },
            { upsert: true, new: true }
        );
    }
}

async function createPaidBookingFromPayload(bookingData, paymentInfo = {}) {
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
        pricePerHour = 0,
        pickupLocation,
        dropoffLocation,
        specialRequests,
        couponCode
    } = bookingData || {};

    if (!renterId || !vehicleId || !startDate || !endDate || !totalDays || !(pricePerDay || pricePerHour)) {
        throw new Error('Missing required booking fields');
    }

    const resolvedVehicle = await resolveBookingVehicleByAnyId(vehicleId);
    if (!resolvedVehicle) {
        throw new Error('Vehicle not found');
    }

    const vehicle = resolvedVehicle.vehicle;
    const additionalVehicle = resolvedVehicle.additionalVehicle;
    const bookingVehicleIds = normalizeVehicleIdList(resolvedVehicle.bookingVehicleIds);

    await assertVehicleAvailable(bookingVehicleIds, startDate, endDate);

    const register = vehicle.registerId || {};
    const rental = vehicle.rentalId || {};
    const ownerName = register.Name || rental.ownerName || 'N/A';
    const ownerPhone = register.ContactNo || rental.ContactNo || 'N/A';
    const displayVehicleModel = additionalVehicle?.model || vehicle.vehicleModel || 'Unknown';
    const displayVehicleType = additionalVehicle?.subcategory || vehicle.vehicleType || 'Unknown';
    const displayVehiclePhoto = additionalVehicle?.photo || vehicle.vehiclePhoto || '/static_bike.png';
    const dailyPrice = pricePerDay || pricePerHour || 0;
    const totalAmount = bookingData.totalAmount || (Number(totalDays) * Number(dailyPrice));
    const couponCategory = additionalVehicle?.category || vehicle.category || vehicle.vehicleType;

    let couponResult = { discount: 0, finalAmount: totalAmount, couponCode: '' };
    if (couponCode) {
        couponResult = await CouponController.applyCoupon(
            couponCode, renterId, totalAmount, couponCategory
        );
    }

    const booking = new Booking({
        renterId,
        renterName,
        renterPhone: renterPhone || 'N/A',
        renterEmail: renterEmail || 'N/A',
        ownerId: vehicle.userId,
        ownerName,
        ownerPhone,
        vehicleId: resolvedVehicle.resolvedVehicleId,
        vehicleModel: displayVehicleModel,
        vehicleType: displayVehicleType,
        vehiclePhoto: displayVehiclePhoto,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        pricePerDay: dailyPrice,
        totalAmount,
        couponCode: couponResult.couponCode,
        discountAmount: couponResult.discount,
        finalAmount: couponResult.finalAmount,
        pickupLocation: pickupLocation || 'To be determined',
        dropoffLocation: dropoffLocation || 'To be determined',
        specialRequests: specialRequests || '',
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: paymentInfo.paymentId || '',
        cashfreeOrderId: paymentInfo.orderId || '',
        paymentMethod: paymentInfo.paymentMethod || 'Cashfree'
    });

    const savedBooking = await booking.save();
    await markBookingDatesUnavailable(savedBooking);

    try {
        await new Notification({
            userId: vehicle.userId,
            title: "New Paid Booking",
            message: `${savedBooking.renterName} paid and booked your ${savedBooking.vehicleModel}`,
            type: "booking_confirmed",
            relatedId: savedBooking._id,
            relatedType: "booking"
        }).save();
    } catch (notifErr) {
        console.error('[Payment] Notification error (non-fatal):', notifErr.message);
    }

    return savedBooking;
}

PaymentController.createOrder = async (req, res) => {
    console.log('[Cashfree] APP_ID:', process.env.CASHFREE_APP_ID ? 'SET ✓' : 'MISSING ✗');
console.log('[Cashfree] SECRET:', process.env.CASHFREE_SECRET_KEY ? 'SET ✓' : 'MISSING ✗');
console.log('[Cashfree] ENV:', process.env.CASHFREE_ENV || 'SANDBOX (default)');
    try {
        const {
            amount, currency = 'INR', bookingId, bookingData,
            customerId, customerPhone, customerEmail, customerName
        } = req.body;

        if (!amount) return Helper.response("Failed", "Amount is required", {}, res, 400);
        if (!bookingId && !bookingData) {
            return Helper.response("Failed", "Booking data is required", {}, res, 400);
        }

        let orderBookingRef = bookingId;
        if (bookingData) {
            const resolvedVehicle = await resolveBookingVehicleByAnyId(bookingData.vehicleId);
            if (!resolvedVehicle) {
                return Helper.response("Failed", "Vehicle not found", {}, res, 404);
            }
            await assertVehicleAvailable(
                normalizeVehicleIdList(resolvedVehicle.bookingVehicleIds),
                bookingData.startDate,
                bookingData.endDate
            );
            orderBookingRef = new mongoose.Types.ObjectId().toString();
        }

        const orderRequest = {
            order_amount: parseFloat(amount),
            order_currency: currency,
            order_id: `order_${orderBookingRef}_${Date.now()}`,
            customer_details: {
                customer_id: String(customerId || 'guest'),
                customer_phone: String(customerPhone).replace(/\D/g, '') || '9999999999',
                customer_email: String(customerEmail || 'guest@example.com').toLowerCase(),
                customer_name: String(customerName || 'Guest').substring(0, 50)
            },
            order_meta: {
                return_url: bookingId
                    ? `${FRONTEND_URL}/booking-confirmation?bookingId=${bookingId}&order_id={order_id}`
                    : `${FRONTEND_URL}/booking-confirmation?order_id={order_id}`,
                notify_url: `${BACKEND_URL}/payments/webhook`
            },
            order_tags: { bookingId: bookingId ? String(bookingId) : '', pendingBooking: bookingData ? 'true' : 'false' }
        };

        if (orderRequest.customer_details.customer_phone.length < 10)
            return Helper.response("Failed", "Invalid Phone Number", {}, res, 400);
        if (!orderRequest.customer_details.customer_email.includes('@'))
            return Helper.response("Failed", "Invalid Email", {}, res, 400);

        // ✅ Called on instance, no API version string
        const response = await cashfree.PGCreateOrder(orderRequest);
        const order = response.data;

        if (bookingData) {
            await PendingBookingPayment.create({
                orderId: order.order_id,
                bookingData,
                amount: parseFloat(amount),
                currency,
                customerId: mongoose.Types.ObjectId.isValid(customerId) ? customerId : null
            });
        }

        Helper.response("Success", "Order created successfully", {
            order_id: order.order_id,
            payment_session_id: order.payment_session_id,
            bookingId: bookingId || null
        }, res, 200);

    } catch (error) {
        console.error('[Payment] Create order error:', error?.response?.data || error.message);
        const statusCode = error?.response?.status || (
            /Vehicle (not available|already booked)|Missing required booking fields|Vehicle not found/.test(error.message)
                ? 400
                : 500
        );
        Helper.response("Failed", error?.response?.data?.message || "Order creation failed",
            error?.response?.data || error.message, res, statusCode);
    }
};

PaymentController.verifyPayment = async (req, res) => {
    try {
        const { orderId, bookingId } = req.body;

        if (!orderId)
            return Helper.response("Failed", "Missing orderId", {}, res, 400);

        let existingBooking = bookingId ? await Booking.findById(bookingId) : null;
        const pendingBookingPayment = !existingBooking
            ? await PendingBookingPayment.findOne({ orderId })
            : null;

        if (!existingBooking && pendingBookingPayment?.bookingId) {
            existingBooking = await Booking.findById(pendingBookingPayment.bookingId);
        }

        if (existingBooking?.paymentStatus === 'paid')
            return Helper.response("Success", "Payment already verified", {
                booking: existingBooking, bookingId: existingBooking._id, alreadyVerified: true
            }, res, 200);

        if (!existingBooking && !pendingBookingPayment) {
            return Helper.response("Failed", "Booking payment session not found", {}, res, 404);
        }

        // ✅ Called on instance
        const response = await cashfree.PGOrderFetchPayments(orderId);
        const payments = response.data;
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (successfulPayment) {
            if (existingBooking) {
                existingBooking.paymentStatus = 'paid';
                existingBooking.paymentId = successfulPayment.cf_payment_id;
                existingBooking.cashfreeOrderId = orderId;
                existingBooking.status = 'confirmed';
                await existingBooking.save();
                await markBookingDatesUnavailable(existingBooking);
            } else {
                existingBooking = await createPaidBookingFromPayload(pendingBookingPayment.bookingData, {
                    paymentId: successfulPayment.cf_payment_id,
                    orderId,
                    paymentMethod: successfulPayment.payment_group || 'Cashfree'
                });
                pendingBookingPayment.status = 'paid';
                pendingBookingPayment.bookingId = existingBooking._id;
                await pendingBookingPayment.save();
            }

            try {
                await sendBookingLifecycleEmails({
                    booking: existingBooking,
                    eventKey: 'payment_confirmed'
                });
            } catch (emailError) {
                console.error('[Payment] confirm email error:', emailError.message);
            }

            return Helper.response("Success", "Payment verified and booking confirmed", {
                booking: existingBooking,
                bookingId: existingBooking._id,
                paymentId: successfulPayment.cf_payment_id,
                status: 'success'
            }, res, 200);
        } else {
            return Helper.response("Failed", "Payment not successful", { status: 'failed' }, res, 400);
        }

    } catch (error) {
        console.error('[Payment] Verify error:', error?.response?.data || error.message);
        const statusCode = /Vehicle (not available|already booked)|Missing required booking fields|Vehicle not found/.test(error.message)
            ? 409
            : 500;
        Helper.response("Failed", "Verification failed", error.message, res, statusCode);
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
            pickupLocation, dropoffLocation,
            couponCode,
            paymentStatus,
            paymentId,
            cashfreeOrderId,
            paymentMethod
        } = req.body;

        if (!renterId || !vehicleId || !startDate || !endDate || totalAmount === undefined) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        if (paymentStatus !== 'paid' && !paymentId) {
            return Helper.response(
                "Failed",
                "Booking is created only after payment. Use /payments/create-order before payment.",
                {},
                res,
                400
            );
        }

        const resolvedVehicle = await resolveBookingVehicleByAnyId(vehicleId);
        if (!resolvedVehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        const vehicle = resolvedVehicle.vehicle;
        const additionalVehicle = resolvedVehicle.additionalVehicle;
        const bookingVehicleIds = normalizeVehicleIdList(resolvedVehicle.bookingVehicleIds);
        const register = vehicle.registerId || {};
        const rental = vehicle.rentalId || {};
        const ownerName = register.Name || rental.ownerName || 'N/A';
        const ownerPhone = register.ContactNo || rental.ContactNo || 'N/A';
        const displayVehicleModel = additionalVehicle?.model || vehicle.vehicleModel || 'Unknown';
        const displayVehicleType = additionalVehicle?.subcategory || vehicle.vehicleType || 'Unknown';
        const displayVehiclePhoto = additionalVehicle?.photo || vehicle.vehiclePhoto || 'https://placehold.co/400x300?text=Vehicle';
        const couponCategory = additionalVehicle?.category || vehicle.category || vehicle.vehicleType;

        await assertVehicleAvailable(bookingVehicleIds, startDate, endDate);

        // Apply coupon if provided
        let couponResult = { discount: 0, finalAmount: totalAmount, couponCode: '' };
        if (couponCode) {
            try {
                couponResult = await CouponController.applyCoupon(
                    couponCode, renterId, totalAmount, couponCategory
                );
            } catch (couponError) {
                return Helper.response("Failed", couponError.message, {}, res, 400);
            }
        }

        const newBooking = new Booking({
            renterId,
            renterName,
            renterPhone: renterPhone || 'N/A',
            renterEmail: renterEmail || 'N/A',
            ownerId: vehicle.userId,
            ownerName,
            ownerPhone,
            vehicleId: resolvedVehicle.resolvedVehicleId,
            vehicleModel: displayVehicleModel,
            vehicleType: displayVehicleType,
            // vehiclePhoto is required in schema - use placeholder if missing
            vehiclePhoto: displayVehiclePhoto,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalDays: totalDays || 1,
            // pricePerDay is required in schema - use pricePerHour as fallback for hourly bookings
            pricePerDay: pricePerDay || pricePerHour || 0,
            totalAmount,
            couponCode: couponResult.couponCode,
            discountAmount: couponResult.discount,
            finalAmount: couponResult.finalAmount,
            pickupLocation: pickupLocation || 'To be determined',
            dropoffLocation: dropoffLocation || 'To be determined',
            status: 'confirmed',
            paymentStatus: 'paid',
            paymentId: paymentId || '',
            cashfreeOrderId: cashfreeOrderId || '',
            paymentMethod: paymentMethod || 'Offline'
        });

        const savedBooking = await newBooking.save();
        await markBookingDatesUnavailable(savedBooking);

        // Notify owner (non-fatal)
        try {
            const ownerNotification = new Notification({
                userId: vehicle.userId,
                title: "New Paid Booking",
                message: `${renterName} paid and booked your ${newBooking.vehicleModel}`,
                type: "booking_confirmed",
                relatedId: savedBooking._id,
                relatedType: "booking"
            });
            await ownerNotification.save();
        } catch (notifErr) {
            console.error('[Payment] Notification error (non-fatal):', notifErr.message);
        }

        try {
            await sendBookingLifecycleEmails({
                booking: savedBooking,
                eventKey: 'payment_confirmed'
            });
        } catch (emailError) {
            console.error('[Payment] paid booking email error:', emailError.message);
        }

        Helper.response("Success", "Booking created successfully", {
            bookingId: savedBooking._id,
            totalAmount,
            discountAmount: couponResult.discount,
            finalAmount: couponResult.finalAmount,
            couponCode: couponResult.couponCode
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

        const lifecycleEvent =
            paymentStatus === 'paid' || status === 'confirmed'
                ? 'payment_confirmed'
                : status === 'cancelled'
                    ? 'cancelled'
                    : status
                        ? 'status_updated'
                        : null;

        if (lifecycleEvent && booking.paymentStatus === 'paid') {
            try {
                await sendBookingLifecycleEmails({
                    booking,
                    eventKey: lifecycleEvent
                });
            } catch (emailError) {
                console.error('[Payment] update-status email error:', emailError.message);
            }
        }

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
