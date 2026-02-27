const express = require('express');
const couponRouter = express.Router();
const CouponController = require('../controller/CouponController');
const adminMiddleware = require('../middleware/admin');
const userMiddleware = require('../middleware/userMiddleware');

// ============================================
// USER ROUTES (require user auth)
// ============================================

// Validate a coupon code
couponRouter.post('/validate', userMiddleware, (req, res, next) => {
    CouponController.validateCoupon(req, res, next);
});

// ============================================
// ADMIN ROUTES (require admin auth)
// ============================================

// Create a new coupon
couponRouter.post('/create', adminMiddleware, (req, res, next) => {
    CouponController.createCoupon(req, res, next);
});

// Get all coupons
couponRouter.get('/', adminMiddleware, (req, res, next) => {
    CouponController.getAllCoupons(req, res, next);
});

// Toggle coupon active/inactive
couponRouter.put('/:id/toggle', adminMiddleware, (req, res, next) => {
    CouponController.toggleCoupon(req, res, next);
});

// Delete a coupon
couponRouter.delete('/:id', adminMiddleware, (req, res, next) => {
    CouponController.deleteCoupon(req, res, next);
});

module.exports = couponRouter;
