const Helper = require('../Helper/Helper');
const Notification = require('../Models/NotificationModel');

const NotificationController = {};

// Get notifications for a user
NotificationController.getNotifications = async (req, res) => {
    try {
        const { userId, page = 1, limit = 20 } = req.query;

        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        const skip = (page - 1) * limit;
        
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Notification.countDocuments({ userId });
        const unreadCount = await Notification.countDocuments({ userId, isRead: false });

        Helper.response("Success", "Notifications retrieved successfully", {
            notifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                unreadCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get notifications error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Mark notification as read
NotificationController.markAsRead = async (req, res) => {
    try {
        const { notificationId, userId } = req.body;

        if (!notificationId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return Helper.response("Failed", "Notification not found", {}, res, 404);
        }

        Helper.response("Success", "Notification marked as read", { notification }, res, 200);

    } catch (error) {
        console.error('Mark notification as read error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Mark all notifications as read
NotificationController.markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        Helper.response("Success", "All notifications marked as read", {}, res, 200);

    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Send push notification
NotificationController.sendPushNotification = async (req, res) => {
    try {
        const { userId, title, message, type, relatedId, relatedType } = req.body;

        if (!userId || !title || !message) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        // Create notification in database
        const notification = new Notification({
            userId,
            title,
            message,
            type: type || 'general',
            relatedId: relatedId || null,
            relatedType: relatedType || null,
            pushSent: true,
            pushSentAt: new Date()
        });

        await notification.save();

        // Here you would integrate with Firebase Cloud Messaging or OneSignal
        // For now, we'll just log it
        console.log(`Push notification sent to user ${userId}: ${title} - ${message}`);

        Helper.response("Success", "Push notification sent successfully", { notification }, res, 200);

    } catch (error) {
        console.error('Send push notification error:', error);
        Helper.response("Failed", "Push notification failed", error.message, res, 500);
    }
};

// Delete notification
NotificationController.deleteNotification = async (req, res) => {
    try {
        const { notificationId, userId } = req.body;

        if (!notificationId || !userId) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            userId
        });

        if (!notification) {
            return Helper.response("Failed", "Notification not found", {}, res, 404);
        }

        Helper.response("Success", "Notification deleted successfully", {}, res, 200);

    } catch (error) {
        console.error('Delete notification error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get notification count
NotificationController.getNotificationCount = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return Helper.response("Failed", "Missing userId", {}, res, 400);
        }

        const unreadCount = await Notification.countDocuments({ userId, isRead: false });
        const totalCount = await Notification.countDocuments({ userId });

        Helper.response("Success", "Notification count retrieved successfully", {
            unreadCount,
            totalCount
        }, res, 200);

    } catch (error) {
        console.error('Get notification count error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = NotificationController;
