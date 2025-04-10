const express = require('express');
const { getNotifications, markAsRead } = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, getNotifications); // Fetch notifications
router.put('/mark-read', protect, markAsRead); // Mark notifications as read

module.exports = router;
