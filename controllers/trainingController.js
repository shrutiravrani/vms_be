const Training = require('../models/Training');
const Event = require('../models/Event');
const User = require('../models/User');

// Upload training video
const uploadTraining = async (req, res) => {
  try {
    const { eventId, title, description } = req.body;
    const uploadedBy = req.user._id;

    console.log('Upload request received:', {
      eventId,
      title,
      description,
      uploadedBy,
      file: req.file ? {
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file'
    });

    // Verify event exists and user is the event manager
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== uploadedBy.toString()) {
      return res.status(403).json({ message: 'Not authorized to upload training for this event' });
    }

    // Get the video URL from the uploaded file
    const videoUrl = `/uploads/training/${req.file.filename}`;
    if (!videoUrl) {
      return res.status(400).json({ message: 'No video file uploaded' });
    }

    console.log('Constructed video URL:', videoUrl);

    // Get the total number of videos for this event to set the order
    const totalVideos = await Training.countDocuments({ eventId });
    const order = totalVideos;

    // Create new training entry
    const training = new Training({
      eventId,
      title,
      description,
      videoUrl,
      uploadedBy,
      order
    });

    await training.save();
    console.log('Training entry saved:', {
      id: training._id,
      title: training.title,
      videoUrl: training.videoUrl,
      eventId: training.eventId
    });

    // Populate the response with event and uploader details
    const populatedTraining = await Training.findById(training._id)
      .populate('eventId', 'title')
      .populate('uploadedBy', 'name');

    console.log('Sending response with populated training:', {
      id: populatedTraining._id,
      title: populatedTraining.title,
      videoUrl: populatedTraining.videoUrl,
      eventId: populatedTraining.eventId?._id
    });

    res.status(201).json(populatedTraining);
  } catch (error) {
    console.error('Error uploading training:', error);
    res.status(500).json({ message: 'Failed to upload training video' });
  }
};

// Get training videos for an event
const getEventTraining = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId);

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check access permissions
    const isEventManager = event.createdBy.toString() === userId.toString();
    const isVolunteer = event.applicants.some(
      applicant => applicant.user.toString() === userId.toString() && 
      applicant.status === 'accepted'
    );

    if (!isEventManager && !isVolunteer) {
      return res.status(403).json({ message: 'Not authorized to view training videos' });
    }

    // Get training videos
    const trainingVideos = await Training.find({ eventId })
      .populate('uploadedBy', 'name')
      .sort({ order: 1, createdAt: 1 });

    res.json(trainingVideos);
  } catch (error) {
    console.error('Error getting training videos:', error);
    res.status(500).json({ message: 'Failed to get training videos' });
  }
};

// Get all training videos for the current user
const getUserTraining = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let trainingVideos;
    if (userRole === 'event_manager') {
      // For event managers, get videos for events they created
      const events = await Event.find({ createdBy: userId });
      const eventIds = events.map(event => event._id);
      trainingVideos = await Training.find({ eventId: { $in: eventIds } })
        .populate('eventId', 'title')
        .populate('uploadedBy', 'name')
        .sort({ order: 1 });
    } else {
      // For volunteers, get videos for events they are accepted in
      const events = await Event.find({
        'applicants.user': userId,
        'applicants.status': 'accepted'
      });
      
      if (events.length === 0) {
        trainingVideos = [];
      } else {
        const eventIds = events.map(event => event._id);
        trainingVideos = await Training.find({ eventId: { $in: eventIds } })
          .populate('eventId', 'title')
          .populate('uploadedBy', 'name')
          .sort({ order: 1 });
      }
    }

    // Log the response for debugging
    console.log('Training videos response:', trainingVideos.map(v => ({
      id: v._id,
      title: v.title,
      videoUrl: v.videoUrl,
      eventId: v.eventId?._id
    })));

    res.json(trainingVideos);
  } catch (error) {
    console.error('Error fetching user training:', error);
    res.status(500).json({ message: 'Failed to fetch training videos' });
  }
};

// Update training video order
const updateTrainingOrder = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { trainingId, newOrder } = req.body;
    const userId = req.user._id;

    // Verify event exists and user is the event manager
    const event = await Event.findById(eventId);
    if (!event || event.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update training order' });
    }

    // Get all training videos for this event to handle order updates
    const allVideos = await Training.find({ eventId }).sort({ order: 1 });
    
    // Find the video being moved
    const videoToMove = allVideos.find(v => v._id.toString() === trainingId);
    if (!videoToMove) {
      return res.status(404).json({ message: 'Training video not found' });
    }

    // Update orders of all affected videos
    if (newOrder > videoToMove.order) {
      // Moving down
      for (let i = videoToMove.order; i < newOrder; i++) {
        await Training.findByIdAndUpdate(allVideos[i]._id, { order: i });
      }
    } else {
      // Moving up
      for (let i = videoToMove.order - 1; i >= newOrder; i--) {
        await Training.findByIdAndUpdate(allVideos[i]._id, { order: i + 1 });
      }
    }

    // Update the moved video's order
    await Training.findByIdAndUpdate(trainingId, { order: newOrder });

    // Get updated list of videos
    const updatedVideos = await Training.find({ eventId })
      .populate('eventId', 'title')
      .sort({ order: 1 });

    res.json(updatedVideos);
  } catch (error) {
    console.error('Error updating training order:', error);
    res.status(500).json({ message: 'Failed to update training order' });
  }
};

// Delete training video
const deleteTraining = async (req, res) => {
  try {
    const { trainingId } = req.params;
    const userId = req.user._id;

    // Get training video and verify ownership
    const training = await Training.findById(trainingId);
    if (!training) {
      return res.status(404).json({ message: 'Training video not found' });
    }

    const event = await Event.findById(training.eventId);
    if (!event || event.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this training video' });
    }

    // Delete the training video
    await Training.findByIdAndDelete(trainingId);

    res.json({ message: 'Training video deleted successfully' });
  } catch (error) {
    console.error('Error deleting training video:', error);
    res.status(500).json({ message: 'Failed to delete training video' });
  }
};

module.exports = {
  uploadTraining,
  getEventTraining,
  getUserTraining,
  updateTrainingOrder,
  deleteTraining
}; 