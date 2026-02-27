const express = require('express');
const UserRouter = express.Router();
const RentalController = require('../controller/RentalController');
const AuthController = require('../controller/AuthController');
const Auth = require('../middleware/userMiddleware');

// Rental Profile Routes
UserRouter.get("/rental/profile", Auth, (req, res, next) => {
    RentalController.getRentalProfile(req, res, next);
});

UserRouter.put("/rental/profile", Auth, (req, res, next) => {
    RentalController.updateRentalProfile(req, res, next);
});

// User Account Management
UserRouter.delete("/account", Auth, (req, res, next) => {
    AuthController.deleteAccount(req, res, next);
});

module.exports = UserRouter;
