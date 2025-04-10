const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  requirements: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  applicants: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
      appliedAt: { type: Date, default: Date.now },
      attendance: { type: String, enum: ['present', 'absent'], default: null },
      completionDetails: {
        hoursServed: { type: Number },
        rating: { type: Number },
        feedback: { type: String },
        skillsDemonstrated: [{ type: String }],
        completedAt: { type: Date, default: Date.now }
      }
    },
  ],
  team: {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // ✅ Keep this to track team members
  }
});

module.exports = mongoose.model('Event', eventSchema);
