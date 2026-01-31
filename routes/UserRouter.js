const express = require('express');
const UserRouter = express.Router();
const RentalController = require('../controller/RentalController');
const Auth = require('../middleware/userMiddleware');

// Rental Profile Routes
UserRouter.get("/rental/profile", Auth, (req, res, next) => {
    RentalController.getRentalProfile(req, res, next);
});

UserRouter.put("/rental/profile", Auth, (req, res, next) => {
    RentalController.updateRentalProfile(req, res, next);
});

module.exports = UserRouter;
