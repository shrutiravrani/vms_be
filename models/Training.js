const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  videoUrl: {
    type: String,
    required: true,
    get: function(url) {
      if (!url) return url;
      // Remove any undefined prefix
      url = url.replace(/^undefined/, '');
      if (url.startsWith('http')) return url;
      return `${process.env.BASE_URL || 'http://localhost:5000'}${url}`;
    }
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number // Duration in seconds
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Index for faster queries
trainingSchema.index({ eventId: 1 });

module.exports = mongoose.model('Training', trainingSchema); 