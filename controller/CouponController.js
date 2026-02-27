const Helper = require('../Helper/Helper');
const Coupon = require('../Models/CouponModel');
const Booking = require('../Models/BookingModel');

const CouponController = {};

// ============================================
// ADMIN: Create a new coupon
// ============================================
CouponController.createCoupon = async (req, res) => {
    try {
        const {
            code, discountType, discountValue, maxDiscount,
            minOrderAmount, validFrom, validTo, maxUsage,
            maxUsagePerUser, applicableCategories, firstRideOnly,
            description
        } = req.body;

        if (!code || !discountType || !discountValue || !validTo) {
            return Helper.response("Failed", "Missing required fields: code, discountType, discountValue, validTo", {}, res, 400);
        }

        // Check if code already exists
        const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
        if (existing) {
            return Helper.response("Failed", "Coupon code already exists", {}, res, 400);
        }

        // Validate discount
        if (discountType === 'percentage' && discountValue > 100) {
            return Helper.response("Failed", "Percentage discount cannot exceed 100%", {}, res, 400);
        }

        const coupon = new Coupon({
            code: code.toUpperCase().trim(),
            discountType,
            discountValue,
            maxDiscount: maxDiscount || null,
            minOrderAmount: minOrderAmount || 0,
            validFrom: validFrom || new Date(),
            validTo: new Date(validTo),
            maxUsage: maxUsage || null,
            maxUsagePerUser: maxUsagePerUser || 1,
            applicableCategories: applicableCategories || [],
            firstRideOnly: firstRideOnly || false,
            description: description || '',
            createdBy: req.admin?.id || null
        });

        const savedCoupon = await coupon.save();
        Helper.response("Success", "Coupon created successfully", savedCoupon, res, 201);

    } catch (error) {
        console.error('Create coupon error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// USER: Validate a coupon code
// ============================================
CouponController.validateCoupon = async (req, res) => {
    try {
        const { code, orderAmount, vehicleCategory } = req.body;
        const userId = req.user.id;

        if (!code) {
            return Helper.response("Failed", "Coupon code is required", {}, res, 400);
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

        if (!coupon) {
            return Helper.response("Failed", "Invalid coupon code", {}, res, 404);
        }

        // Check if active
        if (!coupon.isActive) {
            return Helper.response("Failed", "This coupon is no longer active", {}, res, 400);
        }

        // Check validity dates
        const now = new Date();
        if (now < coupon.validFrom) {
            return Helper.response("Failed", "This coupon is not yet active", {}, res, 400);
        }
        if (now > coupon.validTo) {
            return Helper.response("Failed", "This coupon has expired", {}, res, 400);
        }

        // Check total usage limit
        if (coupon.maxUsage !== null && coupon.usedCount >= coupon.maxUsage) {
            return Helper.response("Failed", "This coupon has reached its usage limit", {}, res, 400);
        }

        // Check per-user usage limit
        const userUsageCount = coupon.usedBy.filter(
            u => u.userId.toString() === userId.toString()
        ).length;
        if (userUsageCount >= coupon.maxUsagePerUser) {
            return Helper.response("Failed", "You have already used this coupon", {}, res, 400);
        }

        // Check minimum order amount
        if (orderAmount && orderAmount < coupon.minOrderAmount) {
            return Helper.response("Failed", `Minimum order amount is ₹${coupon.minOrderAmount}`, {}, res, 400);
        }

        // Check applicable categories
        if (coupon.applicableCategories.length > 0 && vehicleCategory) {
            if (!coupon.applicableCategories.includes(vehicleCategory)) {
                return Helper.response("Failed", "This coupon is not applicable for this vehicle category", {}, res, 400);
            }
        }

        // Check first ride only
        if (coupon.firstRideOnly) {
            const existingBookings = await Booking.countDocuments({
                renterId: userId,
                status: { $in: ['completed', 'in_progress', 'confirmed', 'accepted'] }
            });
            if (existingBookings > 0) {
                return Helper.response("Failed", "This coupon is only valid for your first ride", {}, res, 400);
            }
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = Math.round((orderAmount || 0) * coupon.discountValue / 100);
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount;
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        // Ensure discount doesn't exceed order amount
        if (orderAmount && discountAmount > orderAmount) {
            discountAmount = orderAmount;
        }

        Helper.response("Success", "Coupon is valid", {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount,
            discountAmount: discountAmount,
            finalAmount: orderAmount ? orderAmount - discountAmount : null,
            description: coupon.description
        }, res, 200);

    } catch (error) {
        console.error('Validate coupon error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// ADMIN: Get all coupons
// ============================================
CouponController.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        Helper.response("Success", "Coupons retrieved successfully", coupons, res, 200);
    } catch (error) {
        console.error('Get coupons error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// ADMIN: Toggle coupon active/inactive
// ============================================
CouponController.toggleCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return Helper.response("Failed", "Coupon not found", {}, res, 404);
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        Helper.response("Success", `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`, coupon, res, 200);
    } catch (error) {
        console.error('Toggle coupon error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// ADMIN: Delete a coupon
// ============================================
CouponController.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            return Helper.response("Failed", "Coupon not found", {}, res, 404);
        }

        Helper.response("Success", "Coupon deleted successfully", {}, res, 200);
    } catch (error) {
        console.error('Delete coupon error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// ============================================
// INTERNAL: Apply coupon to a booking (called from BookingController)
// ============================================
CouponController.applyCoupon = async (couponCode, userId, orderAmount, vehicleCategory) => {
    if (!couponCode) return { discount: 0, finalAmount: orderAmount, couponCode: '' };

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim(), isActive: true });
    if (!coupon) throw new Error('Invalid coupon code');

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) throw new Error('Coupon has expired');
    if (coupon.maxUsage !== null && coupon.usedCount >= coupon.maxUsage) throw new Error('Coupon usage limit reached');

    const userUsageCount = coupon.usedBy.filter(u => u.userId.toString() === userId.toString()).length;
    if (userUsageCount >= coupon.maxUsagePerUser) throw new Error('You have already used this coupon');

    if (orderAmount < coupon.minOrderAmount) throw new Error(`Minimum order amount is ₹${coupon.minOrderAmount}`);

    if (coupon.applicableCategories.length > 0 && vehicleCategory) {
        if (!coupon.applicableCategories.includes(vehicleCategory)) throw new Error('Coupon not applicable for this category');
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
        discountAmount = Math.round(orderAmount * coupon.discountValue / 100);
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) discountAmount = coupon.maxDiscount;
    } else {
        discountAmount = coupon.discountValue;
    }
    if (discountAmount > orderAmount) discountAmount = orderAmount;

    // Mark coupon as used
    coupon.usedCount += 1;
    coupon.usedBy.push({ userId, usedAt: new Date() });
    await coupon.save();

    return {
        discount: discountAmount,
        finalAmount: orderAmount - discountAmount,
        couponCode: coupon.code
    };
};

module.exports = CouponController;
