const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { uploadFile } = require('../controllers/uploadController');

const router = express.Router();

console.log('Setting up upload routes...'); // Debug log

// Test route
router.get('/', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Upload route is working' });
});

// Upload route
router.post('/', protect, uploadFile);

// Debug: Log registered routes
console.log('Upload routes registered:', 
  router.stack.map(r => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
);

module.exports = router;