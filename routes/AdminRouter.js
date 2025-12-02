const express = require('express');
const adminRouter = express.Router();
const AdminController = require('../controller/AdminController');
const adminMiddleware = require('../middleware/admin');

// Public routes (no authentication required)
// Admin registration
adminRouter.post('/register', (req, res, next) => {
    console.log('Admin register route hit');
    console.log('Request body:', req.body);
    AdminController.adminRegister(req, res, next);
});
adminRouter.post('/test', (req, res, next) => {
   console.log("Admin test route hit");
   res.status(200).json({ message: "Admin test route working!", timestamp: new Date().toISOString() });
});
// Admin login
adminRouter.post('/login', (req, res, next) => {
    AdminController.adminLogin(req, res, next);
});

// Protected routes (require admin authentication)
// Admin logout
adminRouter.post('/logout', adminMiddleware, (req, res, next) => {
    AdminController.adminLogout(req, res, next);
});

// Get pending driver license verifications
adminRouter.get('/pending-verifications', adminMiddleware, (req, res, next) => {
    AdminController.getPendingVerifications(req, res, next);
});

// Verify driver license
adminRouter.put('/verify-license', adminMiddleware, (req, res, next) => {
    AdminController.verifyDriverLicense(req, res, next);
});

// Get RTO assistance requests
adminRouter.get('/rto-requests', adminMiddleware, (req, res, next) => {
    AdminController.getRTOAssistanceRequests(req, res, next);
});

// Update RTO assistance status
adminRouter.put('/rto-status', adminMiddleware, (req, res, next) => {
    AdminController.updateRTOAssistanceStatus(req, res, next);
});

// Get dashboard statistics
adminRouter.get('/dashboard-stats', adminMiddleware, (req, res, next) => {
    AdminController.getDashboardStats(req, res, next);
});

// Get all bookings for admin
adminRouter.get('/bookings', adminMiddleware, (req, res, next) => {
    AdminController.getAllBookings(req, res, next);
});

// Get all users for admin
adminRouter.get('/users', adminMiddleware, (req, res, next) => {
    AdminController.getAllUsers(req, res, next);
});

// Get all vehicles for admin
adminRouter.get('/vehicles', adminMiddleware, (req, res, next) => {
    AdminController.getAllVehicles(req, res, next);
});

// Get pending vehicle verifications
adminRouter.get('/pending-vehicle-verifications', adminMiddleware, (req, res, next) => {
    AdminController.getPendingVehicleVerifications(req, res, next);
});

// Verify vehicle
adminRouter.put('/verify-vehicle', adminMiddleware, (req, res, next) => {
    AdminController.verifyVehicle(req, res, next);
});

// Get recent activities
adminRouter.get('/recent-activities', adminMiddleware, (req, res, next) => {
    AdminController.getRecentActivities(req, res, next);
});

// Get revenue analytics
adminRouter.get('/revenue-analytics', adminMiddleware, (req, res, next) => {
    AdminController.getRevenueAnalytics(req, res, next);
});

// Get admin profile
adminRouter.get('/profile', adminMiddleware, (req, res, next) => {
    AdminController.getAdminProfile(req, res, next);
});

module.exports = adminRouter;
