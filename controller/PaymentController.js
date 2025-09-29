const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');
const User = require('../Models/userModel');
const Register = require('../Models/RegisterModel');

const PaymentController = {};

// Create Razorpay order
PaymentController.createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;

        if (!amount) {
            return Helper.response("Failed", "Amount is required", {}, res, 400);
        }

        // In a real implementation, you would call Razorpay API here
        // For now, we'll create a mock order
        const order = {
            id: `order_${Date.now()}`,
            amount: amount * 100, // Convert to paise
            currency: currency,
            receipt: receipt || `receipt_${Date.now()}`,
            status: 'created',
            created_at: new Date()
        };

        Helper.response("Success", "Order created successfully", { order }, res, 200);

    } catch (error) {
        console.error('Create order error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Verify payment
PaymentController.verifyPayment = async (req, res) => {
    try {
        const { 
            orderId, 
            paymentId, 
            signature, 
            bookingId,
            amount 
        } = req.body;

        if (!orderId || !paymentId || !signature || !bookingId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // In a real implementation, you would verify the signature with Razorpay
        // For now, we'll assume the payment is successful
        const isPaymentValid = true; // This should be actual Razorpay verification

        if (isPaymentValid) {
            // Update booking status
            const booking = await Booking.findByIdAndUpdate(
                bookingId,
                {
                    status: 'confirmed',
                    paymentId: paymentId,
                    paymentStatus: 'completed',
                    paymentDate: new Date()
                },
                { new: true }
            );

            if (!booking) {
                return Helper.response("Failed", "Booking not found", {}, res, 404);
            }

            Helper.response("Success", "Payment verified successfully", {
                booking,
                paymentId,
                amount
            }, res, 200);
        } else {
            Helper.response("Failed", "Payment verification failed", {}, res, 400);
        }

    } catch (error) {
        console.error('Verify payment error:', error);
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

        if (booking.paymentStatus !== 'completed') {
            return Helper.response("Failed", "Payment not completed", {}, res, 400);
        }

        // In a real implementation, you would call Razorpay refund API
        // For now, we'll create a mock refund
        const refund = {
            id: `rfnd_${Date.now()}`,
            amount: amount * 100, // Convert to paise
            status: 'processed',
            reason: reason || 'Customer request',
            created_at: new Date()
        };

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
            totalAmount
        } = req.body;

        // Validate required fields
        if (!renterId || !vehicleId || !startDate || !endDate || !totalDays || !pricePerDay || !totalAmount) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Verify vehicle exists
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Create booking
        const booking = new Booking({
            renterId,
            renterName,
            renterPhone,
            renterEmail,
            vehicleId,
            vehicleOwnerId: vehicle.userId, // Get owner ID from vehicle
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalDays: parseInt(totalDays),
            pricePerDay: parseFloat(pricePerDay),
            totalAmount: parseFloat(totalAmount),
            status: 'pending_offline_payment',
            paymentStatus: 'pending',
            paymentMethod: 'offline',
            createdAt: new Date()
        });

        await booking.save();

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
        if (status === 'confirmed') updateData.paymentDate = new Date();

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

module.exports = PaymentController;