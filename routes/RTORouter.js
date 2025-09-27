const express = require('express');
const rtoRouter = express.Router();
const RTOController = require('../controller/RTOController');

// Request RTO assistance (The "Magic Button")
rtoRouter.post('/request', (req, res, next) => {
    RTOController.requestRTOAssistance(req, res, next);
});

// Get RTO assistance status
rtoRouter.get('/status', (req, res, next) => {
    RTOController.getRTOAssistanceStatus(req, res, next);
});

// Get all RTO assistance requests for a user
rtoRouter.get('/user-requests', (req, res, next) => {
    RTOController.getUserRTORequests(req, res, next);
});

module.exports = rtoRouter;
