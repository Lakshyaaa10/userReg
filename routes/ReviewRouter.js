const express = require('express');
const router = express.Router();
const ReviewController = require('../controller/ReviewController');
const userMiddleware = require('../middleware/userMiddleware');

// Add Review (Protected)
router.post('/add', userMiddleware, (req, res, next) => {
    ReviewController.addReview(req, res, next);
});

// Get Host Reviews (Public)
router.get('/host/:targetId', (req, res, next) => {
    ReviewController.getHostReviews(req, res, next);
});

// Get Host Profile (Public)
router.get('/profile/:hostId', (req, res, next) => {
    ReviewController.getHostProfile(req, res, next);
});

module.exports = router;
