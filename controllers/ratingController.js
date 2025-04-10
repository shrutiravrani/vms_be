const Rating = require('../models/Rating');
const User = require('../models/User');
const Event = require('../models/Event');

// Create a new rating
exports.createRating = async (req, res) => {
  try {
    const { volunteerId, eventId, rating } = req.body;
    const eventManagerId = req.user._id; // From auth middleware

    // Verify event manager is the creator of the event
    const event = await Event.findById(eventId);
    if (!event || event.createdBy.toString() !== eventManagerId.toString()) {
      return res.status(403).json({ message: 'Not authorized to rate for this event' });
    }

    // Verify volunteer participated in the event
    const volunteerParticipated = event.team.members.includes(volunteerId);
    if (!volunteerParticipated) {
      return res.status(400).json({ message: 'Volunteer did not participate in this event' });
    }

    // Create new rating
    const newRating = await Rating.create({
      volunteerId,
      eventManagerId,
      eventId,
      rating
    });

    // Update volunteer's average rating
    const volunteer = await User.findById(volunteerId);
    const allRatings = await Rating.find({ volunteerId });
    
    const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
    volunteer.ratings.averageRating = totalRating / allRatings.length;
    volunteer.ratings.totalRatings = allRatings.length;
    
    await volunteer.save();

    res.status(201).json(newRating);
  } catch (error) {
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
};

// Get volunteer's ratings
exports.getVolunteerRatings = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const ratings = await Rating.find({ volunteerId })
      .populate('eventManagerId', 'name')
      .populate('eventId', 'title date')
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

// Update a rating
exports.updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { rating } = req.body;
    const eventManagerId = req.user._id;

    const existingRating = await Rating.findById(ratingId);
    if (!existingRating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    if (existingRating.eventManagerId.toString() !== eventManagerId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this rating' });
    }

    existingRating.rating = rating;
    await existingRating.save();

    // Update volunteer's average rating
    const volunteer = await User.findById(existingRating.volunteerId);
    const allRatings = await Rating.find({ volunteerId: existingRating.volunteerId });
    
    const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
    volunteer.ratings.averageRating = totalRating / allRatings.length;
    
    await volunteer.save();

    res.json(existingRating);
  } catch (error) {
    res.status(500).json({ message: 'Error updating rating', error: error.message });
  }
}; 