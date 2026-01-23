const express = require('express');
const notificationRouter = express.Router();
const NotificationController = require('../controller/NotificationController');

// Get notifications for a user
notificationRouter.get('/', (req, res, next) => {
    NotificationController.getNotifications(req, res, next);
});

// Mark notification as read
notificationRouter.put('/read', (req, res, next) => {
    NotificationController.markAsRead(req, res, next);
});

// Mark all notifications as read
notificationRouter.put('/read-all', (req, res, next) => {
    NotificationController.markAllAsRead(req, res, next);
});

// Send push notification
notificationRouter.post('/send', (req, res, next) => {
    NotificationController.sendPushNotification(req, res, next);
});

// Delete notification
notificationRouter.delete('/', (req, res, next) => {
    NotificationController.deleteNotification(req, res, next);
});

// Get notification count
notificationRouter.get('/count', (req, res, next) => {
    NotificationController.getNotificationCount(req, res, next);
});

module.exports = notificationRouter;
