const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/authMiddleware');
const {
  uploadTraining,
  getEventTraining,
  getUserTraining,
  updateTrainingOrder,
  deleteTraining
} = require('../controllers/trainingController');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/training');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Protected routes
router.use(protect);

// Get all training videos for the current user
router.get('/user', getUserTraining);

// Get training videos for a specific event
router.get('/event/:eventId', getEventTraining);

// Upload training video (event managers only)
router.post('/upload', upload.single('video'), uploadTraining);

// Update training video order (event managers only)
router.put('/order/:eventId', updateTrainingOrder);

// Delete training video (event managers only)
router.delete('/:trainingId', deleteTraining);

module.exports = router; 