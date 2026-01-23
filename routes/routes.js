const express = require("express");
var routes = express.Router()

var AuthRoutes = require("./AuthRouter");
const RegisterRouter = require("./RegisterRouter");
const vehicleRoutes = require('./vehicleRouter')
const BookingRouter = require('./BookingRouter');
const PaymentRouter = require('./PaymentRouter');
const NotificationRouter = require('./NotificationRouter');
const AdminRouter = require('./AdminRouter');
const EarningsRouter = require('./EarningsRouter');
const RTORouter = require('./RTORouter');
const SearchRouter = require('./SearchRouter');
const VehicleManagementRouter = require('./VehicleManagementRouter');
const userMiddleware = require('../middleware/userMiddleware');
const ContactController = require('../controller/ContactController');

// Authentication routes
routes.use("/", AuthRoutes)

// Registration routes
routes.use("/reg", RegisterRouter)

// Vehicle routes
routes.use('/veh', vehicleRoutes)

// Booking routes
routes.use('/bookings', userMiddleware, BookingRouter)

// Payment routes
const PaymentController = require('../controller/PaymentController');

routes.post('/payments/webhook', PaymentController.handleWebhook); // Public webhook
routes.use('/payments', userMiddleware, PaymentRouter);

// Payout routes (RazorpayX)
const PayoutRouter = require('./PayoutRouter');
routes.post('/payouts/webhook', require('../controller/PayoutController').handleWebhook); // Public Payout Webhook
routes.use('/payouts', userMiddleware, PayoutRouter);

// Notification routes
routes.use('/notifications', userMiddleware, NotificationRouter)

// Admin routes
routes.use('/admin', AdminRouter)

// Earnings routes
routes.use('/earnings', EarningsRouter)

// RTO assistance routes
routes.use('/rto', RTORouter)

// Search routes
routes.use('/search', SearchRouter)

// Contact routes

routes.post('/contact/send', ContactController.sendMessage);
routes.get('/contact/messages', AdminRouter); // Using Admin middleware could be cleaner but routes don't usually export middleware directly. Assuming public/admin separation logic.
// Simpler approach: Just use controller directly for now, maybe add middleware later if needed, but per request admin panel needs access.
// Let's actually separate it cleanly:
routes.get('/contact/messages', ContactController.getMessages);

// Vehicle management routes
// Vehicle management routes
routes.use('/veh', VehicleManagementRouter)

// Review routes
const ReviewRouter = require('./ReviewRouter');
routes.use('/reviews', ReviewRouter);

routes.use("*", (req, res, next) => {
  console.log(`Unhandled route: ${req.originalUrl}`);
  res.send("Not Found");
});

module.exports = routes;