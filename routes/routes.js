const express = require("express");
var routes = express.Router()

var AuthRoutes = require( "./AuthRouter");
const RegisterRouter = require("./RegisterRouter");
const vehicleRoutes= require('./vehicleRouter')
const BookingRouter = require('./BookingRouter');
const PaymentRouter = require('./PaymentRouter');
const NotificationRouter = require('./NotificationRouter');
const AdminRouter = require('./AdminRouter');
const EarningsRouter = require('./EarningsRouter');
const RTORouter = require('./RTORouter');
const SearchRouter = require('./SearchRouter');
const VehicleManagementRouter = require('./VehicleManagementRouter');

// Authentication routes
routes.use("/",AuthRoutes)

// Registration routes
routes.use("/reg",RegisterRouter)

// Vehicle routes
routes.use('/veh',vehicleRoutes)

// Booking routes
routes.use('/bookings', BookingRouter)

// Payment routes
routes.use('/payments', PaymentRouter)

// Notification routes
routes.use('/notifications', NotificationRouter)

// Admin routes
routes.use('/admin', AdminRouter)

// Earnings routes
routes.use('/earnings', EarningsRouter)

// RTO assistance routes
routes.use('/rto', RTORouter)

// Search routes
routes.use('/search', SearchRouter)

// Vehicle management routes
routes.use('/veh', VehicleManagementRouter)

routes.use("*", (req, res, next) => {
  console.log(`Unhandled route: ${req.originalUrl}`);
    res.send("Not Found");
  });

  module.exports = routes;