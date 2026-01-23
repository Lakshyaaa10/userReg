const express = require('express');
const earningsRouter = express.Router();
const EarningsController = require('../controller/EarningsController');

// Get earnings for an owner
earningsRouter.get('/owner', (req, res, next) => {
    EarningsController.getOwnerEarnings(req, res, next);
});

// Get earnings summary for dashboard
earningsRouter.get('/summary', (req, res, next) => {
    EarningsController.getEarningsSummary(req, res, next);
});

// Get top performing vehicles
earningsRouter.get('/top-vehicles', (req, res, next) => {
    EarningsController.getTopPerformingVehicles(req, res, next);
});

// Get earnings analytics
earningsRouter.get('/analytics', (req, res, next) => {
    EarningsController.getEarningsAnalytics(req, res, next);
});

module.exports = earningsRouter;
