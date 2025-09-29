const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const Availability = require('../Models/AvailabilityModel');
const Notification = require('../Models/NotificationModel');
const Earnings = require('../Models/EarningsModel');

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

        // Get vehicle details
        const Register = require('../Models/RegisterModel');
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

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

        // Create booking
        const newBooking = new Booking({
            renterId,
            renterName,
            renterPhone,
            renterEmail,
            ownerId: vehicle._id,
            ownerName: vehicle.Name,
            ownerPhone: vehicle.ContactNo,
            vehicleId,
            vehicleModel: vehicle.VehicleModel,
            vehicleType: vehicle.vehicleType,
            vehiclePhoto: vehicle.VehiclePhoto,
            startDate: start,
            endDate: end,
            totalDays,
            pricePerDay,
            totalAmount,
            pickupLocation,
            dropoffLocation,
            specialRequests: specialRequests || ''
        });

        const savedBooking = await newBooking.save();

        // Create notification for owner
        const ownerNotification = new Notification({
            userId: vehicle._id, // Assuming owner has a user account
            title: "New Booking Request",
            message: `${renterName} wants to book your ${vehicle.VehicleModel} from ${startDate} to ${endDate}`,
            type: "booking_request",
            relatedId: savedBooking._id,
            relatedType: "booking"
        });
        await ownerNotification.save();

        // Create notification for renter
        const renterNotification = new Notification({
            userId: renterId,
            title: "Booking Request Sent",
            message: `Your booking request for ${vehicle.VehicleModel} has been sent to the owner`,
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
            .populate('vehicleId', 'VehicleModel vehicleType VehiclePhoto')
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
            .populate('vehicleId', 'VehicleModel vehicleType VehiclePhoto')
            .populate('renterId', 'mobile email username');

        Helper.response("Success", "Renter bookings retrieved successfully", bookings, res, 200);

    } catch (error) {
        console.error('Get renter bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update booking status (accept/reject)
BookingController.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId, status, ownerId } = req.body;

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
        if (status === 'accepted') {
            booking.acceptedAt = new Date();
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
            paymentStatus: 'paid',
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
            type: "booking_cancelled",
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

module.exports = BookingController;
