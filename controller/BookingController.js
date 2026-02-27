const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const Notification = require('../Models/NotificationModel');
const Earnings = require('../Models/EarningsModel');
const CouponController = require('./CouponController');

const BookingController = {};

// Create a new booking request
BookingController.createBooking = async (req, res) => {
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
            pickupLocation,
            dropoffLocation,
            specialRequests
        } = req.body;

        // Validation
        if (!renterId || !vehicleId || !startDate || !endDate || !totalDays || !pricePerDay) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Get vehicle details from RegisteredVehicles
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
        const ownerName = register.Name || rental.ownerName || 'N/A';
        const ownerPhone = register.ContactNo || rental.ContactNo || 'N/A';

        // Check availability
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const availability = await Availability.findOne({
                vehicleId: vehicleId,
                date: d,
                isAvailable: false
            });

            if (availability) {
                return Helper.response("Failed", `Vehicle not available on ${d.toDateString()}`, {}, res, 400);
            }
        }

        // Calculate total amount
        const totalAmount = totalDays * pricePerDay;
        const platformFee = Math.round(totalAmount * 0.1); // 10% platform fee
        const netAmount = totalAmount - platformFee;

        // Apply coupon if provided
        let couponResult = { discount: 0, finalAmount: totalAmount, couponCode: '' };
        const couponCode = req.body.couponCode;
        if (couponCode) {
            try {
                couponResult = await CouponController.applyCoupon(
                    couponCode, renterId, totalAmount, vehicle.category
                );
            } catch (couponError) {
                return Helper.response("Failed", couponError.message, {}, res, 400);
            }
        }

        // Create booking
        const newBooking = new Booking({
            renterId,
            renterName,
            renterPhone,
            renterEmail,
            ownerId: vehicle.userId, // Use userId from RegisteredVehicles
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            vehicleId,
            vehicleModel: vehicle.vehicleModel,
            vehicleType: vehicle.vehicleType,
            vehiclePhoto: vehicle.vehiclePhoto,
            startDate: start,
            endDate: end,
            totalDays,
            pricePerDay,
            totalAmount,
            couponCode: couponResult.couponCode,
            discountAmount: couponResult.discount,
            finalAmount: couponResult.finalAmount,
            pickupLocation,
            dropoffLocation,
            specialRequests: specialRequests || ''
        });

        const savedBooking = await newBooking.save();

        // Mark dates as unavailable in Availability collection
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            await Availability.findOneAndUpdate(
                {
                    vehicleId: vehicleId,
                    date: d
                },
                {
                    vehicleId: vehicleId,
                    ownerId: vehicle._id,
                    date: d,
                    isAvailable: false,
                    reason: 'booked'
                },
                { upsert: true, new: true }
            );
        }

        // Create notification for owner
        const ownerNotification = new Notification({
            userId: vehicle.userId, // Use userId from RegisteredVehicles
            title: "New Booking Request",
            message: `${renterName} wants to book your ${vehicle.vehicleModel} from ${startDate} to ${endDate}`,
            type: "booking_request",
            relatedId: savedBooking._id,
            relatedType: "booking"
        });
        await ownerNotification.save();

        // Create notification for renter
        const renterNotification = new Notification({
            userId: renterId,
            title: "Booking Request Sent",
            message: `Your booking request for ${vehicle.vehicleModel} has been sent to the owner`,
            type: "booking_request",
            relatedId: savedBooking._id,
            relatedType: "booking"
        });
        await renterNotification.save();

        Helper.response("Success", "Booking request created successfully", { bookingId: savedBooking._id }, res, 201);

    } catch (error) {
        console.error('Create booking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get bookings for a user (renter or owner)
BookingController.getUserBookings = async (req, res) => {
    try {
        const { userId, userType } = req.query; // userType: 'renter' or 'owner'

        if (!userId || !userType) {
            return Helper.response("Failed", "Missing userId or userType", {}, res, 400);
        }

        let query = {};
        if (userType === 'renter') {
            query.renterId = userId;
        } else if (userType === 'owner') {
            query.ownerId = userId;
        }

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .populate('vehicleId', 'vehicleModel vehicleType vehiclePhoto')
            .populate('renterId', 'mobile email');

        Helper.response("Success", "Bookings retrieved successfully", bookings, res, 200);

    } catch (error) {
        console.error('Get bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get bookings for a specific renter
BookingController.getRenterBookings = async (req, res) => {
    try {
        const { renterId } = req.params;

        if (!renterId) {
            return Helper.response("Failed", "Missing renterId", {}, res, 400);
        }

        const bookings = await Booking.find({ renterId: renterId })
            .sort({ createdAt: -1 })
            .populate('vehicleId', 'vehicleModel vehicleType vehiclePhoto')
            .populate('renterId', 'mobile email username');

        Helper.response("Success", "Renter bookings retrieved successfully", bookings, res, 200);

    } catch (error) {
        console.error('Get renter bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get bookings for a specific owner
BookingController.getOwnerBookings = async (req, res) => {
    try {
        const { ownerId } = req.params;

        if (!ownerId) {
            return Helper.response("Failed", "Missing ownerId", {}, res, 400);
        }

        const bookings = await Booking.find({ ownerId: ownerId })
            .sort({ createdAt: -1 })
            .populate('vehicleId', 'vehicleModel vehicleType vehiclePhoto')
            .populate('renterId', 'mobile email username');

        Helper.response("Success", "Owner bookings retrieved successfully", bookings, res, 200);

    } catch (error) {
        console.error('Get owner bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update booking status (accept/reject)
BookingController.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId, status, ownerId, paymentMethod, paymentStatus } = req.body;

        if (!bookingId || !status || !ownerId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Verify owner
        if (booking.ownerId.toString() !== ownerId) {
            return Helper.response("Failed", "Unauthorized", {}, res, 403);
        }

        // Update booking status
        booking.status = status;

        // Update payment method if provided
        if (paymentMethod) {
            booking.paymentMethod = paymentMethod;
        }

        // Update payment status if provided
        if (paymentStatus) {
            if (['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
                booking.paymentStatus = paymentStatus;
            }
        }

        if (status === 'accepted' || status === 'confirmed') {
            if (status === 'accepted') booking.acceptedAt = new Date();

            // Mark dates as unavailable when booking is accepted/confirmed
            const start = new Date(booking.startDate);
            const end = new Date(booking.endDate);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                await Availability.findOneAndUpdate(
                    {
                        vehicleId: booking.vehicleId,
                        date: d
                    },
                    {
                        vehicleId: booking.vehicleId,
                        ownerId: booking.ownerId,
                        date: d,
                        isAvailable: false,
                        reason: 'booked'
                    },
                    { upsert: true, new: true }
                );
            }
        } else if (status === 'rejected' || status === 'cancelled') {
            // Mark dates as available again when booking is rejected/cancelled
            const start = new Date(booking.startDate);
            const end = new Date(booking.endDate);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                await Availability.findOneAndUpdate(
                    {
                        vehicleId: booking.vehicleId,
                        date: d
                    },
                    {
                        vehicleId: booking.vehicleId,
                        ownerId: booking.ownerId,
                        date: d,
                        isAvailable: true,
                        reason: 'personal_use'
                    },
                    { upsert: true, new: true }
                );
            }
        }
        await booking.save();

        // Create notification for renter
        const notification = new Notification({
            userId: booking.renterId,
            title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your booking request for ${booking.vehicleModel} has been ${status}`,
            type: status === 'accepted' ? 'booking_accepted' : 'booking_rejected',
            relatedId: bookingId,
            relatedType: "booking"
        });
        await notification.save();

        Helper.response("Success", `Booking ${status} successfully`, { booking }, res, 200);

    } catch (error) {
        console.error('Update booking status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Complete booking
BookingController.completeBooking = async (req, res) => {
    try {
        const { bookingId, ownerId } = req.body;

        if (!bookingId || !ownerId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Verify owner
        if (booking.ownerId.toString() !== ownerId) {
            return Helper.response("Failed", "Unauthorized", {}, res, 403);
        }

        // Update booking status
        booking.status = 'completed';
        booking.completedAt = new Date();
        await booking.save();

        // Create earnings record
        const platformFee = Math.round(booking.totalAmount * 0.1);
        const netAmount = booking.totalAmount - platformFee;

        const earnings = new Earnings({
            ownerId: booking.ownerId,
            vehicleId: booking.vehicleId,
            bookingId: booking._id,
            grossAmount: booking.totalAmount,
            platformFee: platformFee,
            netAmount: netAmount,
            netAmount: netAmount,
            paymentStatus: 'paid',
            paymentMethod: booking.paymentMethod || 'Online',
            paymentDate: new Date(),
            tripStartDate: booking.startDate,
            tripEndDate: booking.endDate,
            tripDuration: booking.totalDays
        });
        await earnings.save();

        // Create notification for renter
        const notification = new Notification({
            userId: booking.renterId,
            title: "Trip Completed",
            message: `Your trip with ${booking.vehicleModel} has been completed successfully`,
            type: "general",
            relatedId: bookingId,
            relatedType: "booking"
        });
        await notification.save();

        // ---------------------------------------------------------
        // AUTOMATED PAYOUT TRIGGER (INSTANT) - DISABLED (No RazorpayX)
        // ---------------------------------------------------------
        /*
        try {
            const PayoutController = require('./PayoutController');
            // We don't await this if we want it to run in background, 
            // BUT for "Instant" feel and error tracking, let's await it or catch error simply.
            await PayoutController.processPayoutForBooking(bookingId);
            console.log(`[Booking] Instant payout triggered for ${bookingId}`);
        } catch (payoutError) {
            console.error(`[Booking] Auto-payout failed for ${bookingId}:`, payoutError.message);
            // We don't fail the completion request, just log it. Admin can retry manually.
        }
        */
        // ---------------------------------------------------------

        Helper.response("Success", "Booking completed successfully", { booking, earnings }, res, 200);

    } catch (error) {
        console.error('Complete booking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Cancel booking
BookingController.cancelBooking = async (req, res) => {
    try {
        const { bookingId, reason } = req.body;

        if (!bookingId) {
            return Helper.response("Failed", "Missing bookingId", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Check if booking can be cancelled
        if (booking.status === 'completed' || booking.status === 'cancelled') {
            return Helper.response("Failed", "Booking cannot be cancelled", {}, res, 400);
        }

        // Update booking status
        booking.status = 'cancelled';
        booking.cancellationReason = reason || 'Cancelled by user';
        await booking.save();

        // Create notification for owner
        const ownerNotification = new Notification({
            userId: booking.ownerId,
            title: "Booking Cancelled",
            message: `Booking for ${booking.vehicleModel} has been cancelled`,
            type: "cancelled",
            relatedId: bookingId,
            relatedType: "booking"
        });
        await ownerNotification.save();

        Helper.response("Success", "Booking cancelled successfully", { booking }, res, 200);

    } catch (error) {
        console.error('Cancel booking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get booking by ID
BookingController.getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return Helper.response("Failed", "Missing bookingId", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId)
            .populate('vehicleId', 'vehicleModel vehicleType vehiclePhoto')
            .populate('renterId', 'mobile email username fullName')
            .populate('ownerId', 'Name ContactNo');

        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        Helper.response("Success", "Booking retrieved successfully", booking, res, 200);

    } catch (error) {
        console.error('Get booking by ID error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// Extend an active booking
// ============================================
BookingController.extendBooking = async (req, res) => {
    try {
        const { bookingId, newEndDate } = req.body;

        if (!bookingId || !newEndDate) {
            return Helper.response("Failed", "Missing required fields: bookingId, newEndDate", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Only active bookings can be extended
        const allowedStatuses = ['accepted', 'confirmed', 'in_progress'];
        if (!allowedStatuses.includes(booking.status)) {
            return Helper.response("Failed", `Booking cannot be extended (current status: ${booking.status})`, {}, res, 400);
        }

        const currentEndDate = new Date(booking.endDate);
        const requestedEndDate = new Date(newEndDate);

        // New end date must be after current end date
        if (requestedEndDate <= currentEndDate) {
            return Helper.response("Failed", "New end date must be after the current end date", {}, res, 400);
        }

        // Calculate additional days
        const timeDiff = requestedEndDate.getTime() - currentEndDate.getTime();
        const additionalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // Check availability for extension dates
        for (let d = new Date(currentEndDate); d <= requestedEndDate; d.setDate(d.getDate() + 1)) {
            // Skip the current end date (already booked)
            if (d.getTime() === currentEndDate.getTime()) continue;

            const availability = await Availability.findOne({
                vehicleId: booking.vehicleId,
                date: d,
                isAvailable: false
            });

            if (availability && availability.reason !== 'booked') {
                return Helper.response("Failed", `Vehicle not available on ${d.toDateString()}`, {}, res, 400);
            }

            // Check if another booking has this date
            const conflictingBooking = await Booking.findOne({
                vehicleId: booking.vehicleId,
                _id: { $ne: bookingId },
                status: { $in: ['accepted', 'confirmed', 'in_progress'] },
                startDate: { $lte: d },
                endDate: { $gte: d }
            });

            if (conflictingBooking) {
                return Helper.response("Failed", `Vehicle is booked by someone else on ${d.toDateString()}`, {}, res, 400);
            }
        }

        // Calculate additional amount
        const additionalAmount = additionalDays * booking.pricePerDay;

        // Save original end date on first extension
        if (!booking.originalEndDate) {
            booking.originalEndDate = booking.endDate;
        }

        // Push to extension history
        booking.extensionHistory.push({
            previousEndDate: booking.endDate,
            newEndDate: requestedEndDate,
            additionalDays,
            additionalAmount,
            extendedAt: new Date()
        });

        // Update booking
        booking.endDate = requestedEndDate;
        booking.totalDays = booking.totalDays + additionalDays;
        booking.totalAmount = booking.totalAmount + additionalAmount;
        if (booking.finalAmount !== null) {
            booking.finalAmount = booking.finalAmount + additionalAmount;
        }
        booking.extensionCount = (booking.extensionCount || 0) + 1;

        await booking.save();

        // Mark new dates as unavailable
        for (let d = new Date(currentEndDate); d <= requestedEndDate; d.setDate(d.getDate() + 1)) {
            if (d.getTime() === currentEndDate.getTime()) continue;
            await Availability.findOneAndUpdate(
                { vehicleId: booking.vehicleId, date: d },
                {
                    vehicleId: booking.vehicleId,
                    ownerId: booking.ownerId,
                    date: d,
                    isAvailable: false,
                    reason: 'booked'
                },
                { upsert: true, new: true }
            );
        }

        // Notify owner
        const ownerNotification = new Notification({
            userId: booking.ownerId,
            title: "Booking Extended",
            message: `${booking.renterName} extended their booking for ${booking.vehicleModel} by ${additionalDays} day(s) until ${requestedEndDate.toDateString()}`,
            type: "general",
            relatedId: bookingId,
            relatedType: "booking"
        });
        await ownerNotification.save();

        Helper.response("Success", "Booking extended successfully", {
            booking,
            additionalDays,
            additionalAmount,
            newEndDate: requestedEndDate
        }, res, 200);

    } catch (error) {
        console.error('Extend booking error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = BookingController;
