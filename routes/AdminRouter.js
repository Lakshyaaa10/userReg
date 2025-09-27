const express = require('express');
const adminRouter = express.Router();
const AdminController = require('../controller/AdminController');

// Admin login
adminRouter.post('/login', (req, res, next) => {
    AdminController.adminLogin(req, res, next);
});

// Get pending driver license verifications
adminRouter.get('/pending-verifications', (req, res, next) => {
    AdminController.getPendingVerifications(req, res, next);
});

// Verify driver license
adminRouter.put('/verify-license', (req, res, next) => {
    AdminController.verifyDriverLicense(req, res, next);
});

// Get RTO assistance requests
adminRouter.get('/rto-requests', (req, res, next) => {
    AdminController.getRTOAssistanceRequests(req, res, next);
});

// Update RTO assistance status
adminRouter.put('/rto-status', (req, res, next) => {
    AdminController.updateRTOAssistanceStatus(req, res, next);
});

// Get dashboard statistics
adminRouter.get('/dashboard-stats', (req, res, next) => {
    AdminController.getDashboardStats(req, res, next);
});

// Get all bookings for admin
adminRouter.get('/bookings', (req, res, next) => {
    AdminController.getAllBookings(req, res, next);
});

module.exports = adminRouter;
