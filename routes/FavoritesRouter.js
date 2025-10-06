const express = require('express');
const FavoritesController = require('../controller/FavoritesController');

const favoritesRouter = express.Router();

// Add vehicle to favorites
favoritesRouter.post('/add', (req, res, next) => {
    FavoritesController.addToFavorites(req, res, next);
});

// Remove vehicle from favorites
favoritesRouter.post('/remove', (req, res, next) => {
    FavoritesController.removeFromFavorites(req, res, next);
});

// Get user's favorite vehicles
favoritesRouter.get('/user/:userId', (req, res, next) => {
    FavoritesController.getUserFavorites(req, res, next);
});

// Check if vehicle is in user's favorites
favoritesRouter.get('/check', (req, res, next) => {
    FavoritesController.checkFavoriteStatus(req, res, next);
});

// Toggle favorite status (add if not exists, remove if exists)
favoritesRouter.post('/toggle', (req, res, next) => {
    FavoritesController.toggleFavorite(req, res, next);
});

module.exports = favoritesRouter;
