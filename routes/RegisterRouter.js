const express = require('express');
var RegisterRouter = express.Router();
const Register = require('../controller/RegiterContoller');
const RentalController = require('../controller/RentalController');
const Auth = require('../middleware/userMiddleware'); // Corrected middleware import

RegisterRouter.post("/register", (req, res, next) => {
    Register.registerVehicle(req, res, next)
})
RegisterRouter.post("/registerRental", (req, res, next) => {
    Register.registerRental(req, res, next)
})

// Rental Profile Routes
RegisterRouter.get("/rental/profile", Auth, (req, res, next) => {
    RentalController.getRentalProfile(req, res, next);
});

RegisterRouter.put("/rental/profile", Auth, (req, res, next) => {
    RentalController.updateRentalProfile(req, res, next);
});

module.exports = RegisterRouter