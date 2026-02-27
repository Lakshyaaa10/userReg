const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    // Coupon Code
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    // Discount Details
    discountType: {
        type: String,
        enum: ['percentage', 'flat'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscount: {
        type: Number, // Cap for percentage discounts (e.g., max ₹200 off)
        default: null
    },
    minOrderAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Validity
    validFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    validTo: {
        type: Date,
        required: true
    },

    // Usage Limits
    maxUsage: {
        type: Number, // Total uses allowed across all users
        default: null // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    maxUsagePerUser: {
        type: Number,
        default: 1
    },
    usedBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Targeting
    applicableCategories: [{
        type: String // '2-wheeler', '4-wheeler', or empty for all
    }],
    firstRideOnly: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        default: ''
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    // Admin
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook
couponSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validTo: 1 });

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
