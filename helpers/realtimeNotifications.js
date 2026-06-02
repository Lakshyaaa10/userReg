const userModel = require('../Models/userModel');
const path = require('path');
const fs = require('fs');

let io = null;
let firebaseApp = null;
let firebaseAdmin = null;
let firebaseInitAttempted = false;

function setSocketServer(socketServer) {
    io = socketServer;
}

function getFirebaseAdmin() {
    if (firebaseInitAttempted) {
        return firebaseAdmin;
    }

    firebaseInitAttempted = true;

    try {
        firebaseAdmin = require('firebase-admin');
    } catch (error) {
        console.warn('firebase-admin not installed; FCM disabled');
        return null;
    }

    try {
        if (firebaseAdmin.apps.length) {
            firebaseApp = firebaseAdmin.app();
            return firebaseAdmin;
        }

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            firebaseApp = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert(serviceAccount)
            });
            return firebaseAdmin;
        }

        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
            const resolvedPath = path.isAbsolute(configuredPath)
                ? configuredPath
                : path.resolve(process.cwd(), configuredPath);
            const fallbackPath = path.join(__dirname, '..', 'firebase-backend.json');
            const serviceAccount = require(fs.existsSync(resolvedPath) ? resolvedPath : fallbackPath);
            firebaseApp = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert(serviceAccount)
            });
            return firebaseAdmin;
        }

        const localServiceAccountPath = path.join(__dirname, '..', 'firebase-backend.json');
        const serviceAccount = require(localServiceAccountPath);
        firebaseApp = firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount)
        });
        return firebaseAdmin;

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            firebaseApp = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.applicationDefault()
            });
            return firebaseAdmin;
        }

        console.warn('Firebase credentials missing; FCM disabled');
        return null;
    } catch (error) {
        console.error('Firebase init failed:', error.message);
        return null;
    }
}

function emitNotification(notification) {
    if (!io || !notification?.userId) return;

    io.to(`user:${notification.userId.toString()}`).emit('notification:new', notification);
    io.to(`user:${notification.userId.toString()}`).emit('notification:count:update', {
        userId: notification.userId,
        notificationId: notification._id
    });
}

async function sendFcmNotification(notification) {
    const admin = getFirebaseAdmin();
    if (!admin || !notification?.userId) return false;

    const user = await userModel.findById(notification.userId).select('pushToken');
    const token = notification.pushToken || user?.pushToken;

    if (!token) return false;

    await admin.messaging().send({
        token,
        notification: {
            title: notification.title,
            body: notification.message
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'zugo_default_notifications',
                sound: 'default'
            }
        },
        data: {
            notificationId: notification._id.toString(),
            type: notification.type || 'general',
            relatedId: notification.relatedId ? notification.relatedId.toString() : '',
            relatedType: notification.relatedType || ''
        }
    });

    await notification.constructor.updateOne(
        { _id: notification._id },
        { pushSent: true, pushSentAt: new Date(), pushToken: token }
    );

    return true;
}

async function dispatchNotification(notification) {
    emitNotification(notification);

    try {
        await sendFcmNotification(notification);
    } catch (error) {
        console.error('FCM send failed:', error.message);
    }
}

module.exports = {
    setSocketServer,
    dispatchNotification
};
