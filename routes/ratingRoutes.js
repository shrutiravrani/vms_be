const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  createRating,
  getVolunteerRatings,
  updateRating
} = require('../controllers/ratingController');

// All routes are protected and require authentication
router.use(protect);

// Create a new rating
router.post('/', createRating);

// Get all ratings for a volunteer
router.get('/volunteer/:volunteerId', getVolunteerRatings);

// Update a rating
router.put('/:ratingId', updateRating);

module.exports = router; 