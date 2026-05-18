const mongoose = require('mongoose');

const pendingBookingPaymentSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    bookingData: {
        type: Object,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 60 * 60 * 1000)
    }
}, { timestamps: true });

pendingBookingPaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingBookingPayment = mongoose.models.PendingBookingPayment ||
    mongoose.model('PendingBookingPayment', pendingBookingPaymentSchema);

module.exports = PendingBookingPayment;
