const express = require('express');
const searchRouter = express.Router();
const SearchController = require('../controller/SearchController');

// Search vehicles with filters
searchRouter.get('/vehicles', (req, res, next) => {
    SearchController.searchVehicles(req, res, next);
});

// Get vehicle details by ID
searchRouter.get('/vehicle/:vehicleId', (req, res, next) => {
    SearchController.getVehicleDetails(req, res, next);
});

// Get popular cities
searchRouter.get('/cities', (req, res, next) => {
    SearchController.getPopularCities(req, res, next);
});

// Get vehicle types
searchRouter.get('/vehicle-types', (req, res, next) => {
    SearchController.getVehicleTypes(req, res, next);
});

// Get vehicles by category with enhanced filtering
searchRouter.get('/vehicles/category', (req, res, next) => {
    SearchController.getVehiclesByCategory(req, res, next);
});

// Get vehicle categories with counts
searchRouter.get('/categories', (req, res, next) => {
    SearchController.getVehicleCategories(req, res, next);
});

// Get owner details by vehicle ID
searchRouter.get('/owner/:vehicleId', (req, res, next) => {
    SearchController.getOwnerDetails(req, res, next);
});

// Check vehicle availability
searchRouter.post('/check-availability', (req, res, next) => {
    SearchController.checkAvailability(req, res, next);
});

searchRouter.get('/rentals', (req, res, next) => {
    SearchController.getRentals(req, res, next);
});

// Get all vehicles for a specific rental business
searchRouter.get('/rental/:rentalId/vehicles', (req, res, next) => {
    SearchController.getRentalVehicles(req, res, next);
});

module.exports = searchRouter;
