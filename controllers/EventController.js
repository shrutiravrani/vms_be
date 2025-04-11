const Event = require('../models/Event');
const { addNotification } = require('./notificationController');
const Chat = require('../models/Chat'); 
const mongoose = require('mongoose');
const User = require('../models/User');
const Rating = require('../models/Rating');

// Create a new event
const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, requirements } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create the event
    const newEvent = new Event({
      title,
      description,
      date,
      location,
      requirements,
      createdBy: req.user._id,
      team: { members: [req.user._id] }, //  Event manager is added to the team
    });

    await newEvent.save();

    //  Check if chat group already exists
    let chatGroup = await Chat.findOne({ eventId: newEvent._id });

    if (!chatGroup) {
      chatGroup = new Chat({
        eventId: newEvent._id,
        members: [req.user._id], //  Only the event manager initially
        messages: [{ sender: req.user._id, text: `Welcome to the "${title}" chat!` }],
      });

      await chatGroup.save();
    }

    res.status(201).json({ message: 'Event created successfully', event: newEvent });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong', details: error.message });
  }
};

// Fetch events
const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, date } = req.query;
    const filter = {};

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user data' });
    }

    // Event Managers should see ONLY their events
    // Volunteers should see ALL upcoming events
    if (req.user.role === 'event_manager') {
      filter.createdBy = req.user._id;
    } else if (req.user.role === 'volunteer') {
      // For volunteers, show all upcoming events
      filter.date = { $gte: new Date() };
    }

    // Check if this is the /created endpoint
    const isCreatedEndpoint = req.path === '/created';

    if (isCreatedEndpoint) {
      // For /created endpoint, return simple array of events without pagination
      const events = await Event.find(filter)
        .select('title')
        .sort({ date: 1 });

      return res.json(events.map(event => ({
        _id: event._id,
        title: event.title
      })));
    }

    // Add date filter if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    console.log('User Role:', req.user.role);
    console.log('User ID:', req.user._id);
    console.log('Filter:', JSON.stringify(filter, null, 2));
    console.log('Page:', page);
    console.log('Limit:', limit);

    // Get total count first
    const total = await Event.countDocuments(filter);
    console.log('Total events found:', total);

    // Fetch events with pagination
    const events = await Event.find(filter)
      .populate('createdBy', 'name email')
      .populate('applicants.user', 'name email')
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log('Events fetched:', events.length);
    console.log('First event date:', events[0]?.date);
    console.log('Last event date:', events[events.length - 1]?.date);

    // Format the response
    const formattedEvents = events.map(event => ({
      ...event.toObject(),
      hasApplied: event.applicants.some(
        applicant => applicant.user._id.toString() === req.user._id.toString()
      )
    }));

    res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      events: formattedEvents,
    });
  } catch (error) {
    console.error('Error in getEvents:', error);
    res.status(500).json({ error: 'Something went wrong', details: error.message });
  }
};


// Apply for an event
const applyForEvent = async (req, res) => {
  try {
    console.log('Received application request for event:', req.params.id);
    console.log('User making request:', req.user._id);

    if (req.user.role === 'event_manager') {
      return res.status(403).json({ error: 'Event managers cannot apply for events' });
    }

    const { id } = req.params;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    console.log('Searching for event with ID:', id);
    const event = await Event.findById(id);
    console.log('Event found:', event ? 'Yes' : 'No');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event date has passed
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({ error: 'Cannot apply to past events' });
    }

    // Check if already applied using _id instead of id
    const alreadyApplied = event.applicants.some(
      (applicant) => applicant.user.toString() === req.user._id.toString()
    );

    if (alreadyApplied) {
      return res.status(400).json({ error: 'You have already applied for this event' });
    }

    // Add the user to applicants array with pending status
    event.applicants.push({ 
      user: req.user._id,
      status: 'pending'
    });
    
    await event.save();
    console.log('Application saved successfully');

    // Create notification for event manager
    const managerMessage = `${req.user.name} has applied for your event "${event.title}".`;
    await addNotification(event.createdBy, managerMessage);

    res.status(200).json({ 
      message: 'Application submitted successfully',
      event: {
        _id: event._id,
        title: event.title,
        applicants: event.applicants
      }
    });
  } catch (error) {
    console.error('Error in applyForEvent:', error);
    res.status(500).json({ error: 'Failed to apply for the event', details: error.message });
  }
};


// Fetch applications for an event
const getApplications = async (req, res) => {
  try {
    console.log(`Received request for applications - Event ID: ${req.params.id}`);

    if (req.user.role !== 'event_manager') {
      console.log("Unauthorized user tried accessing applications");
      return res.status(403).json({ error: 'Only event managers can view applications' });
    }

    const { id } = req.params;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    const event = await Event.findById(id)
      .populate('applicants.user', 'name email bio')
      .populate('createdBy', 'name email');

    if (!event) {
      console.log("Event not found:", id);
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.createdBy._id.toString() !== req.user._id.toString()) {
      console.log("User is not authorized to view these applications");
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Format applications with consistent status casing
    const formattedApplicants = event.applicants.map(applicant => ({
      ...applicant.toObject(),
      status: applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)
    }));

    console.log("Returning applications for event:", id);
    res.status(200).json({ applicants: formattedApplicants });
  } catch (error) {
    console.error("Error Fetching Applications:", error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};


//for volunteer application
const getMyApplications = async (req, res) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ message: 'Only volunteers can view their applications' });
    }

    const userId = req.user._id;
    const appliedEvents = await Event.find({ 'applicants.user': userId })
      .select('title date applicants createdBy')
      .populate('createdBy', 'name email');

    const formattedEvents = appliedEvents.map(event => {
      const application = event.applicants.find(a => a.user.toString() === userId.toString());
      return {
        _id: event._id,
        eventTitle: event.title,
        date: event.date,
        eventManager: event.createdBy.name,
        appliedAt: application.appliedAt,
        status: application.status.charAt(0).toUpperCase() + application.status.slice(1)
      };
    });

    res.status(200).json(formattedEvents);
  } catch (error) {
    console.error('Error in getMyApplications:', error);
    res.status(500).json({ message: 'Failed to fetch applied events.', error: error.message });
  }
};


// Update application status
const updateApplicationStatus = async (req, res) => {
  try {
    if (req.user.role !== 'event_manager') {
      return res.status(403).json({ message: 'Only event managers can update application status' });
    }

    const { id, applicationId } = req.params;
    const { status } = req.body;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find the application in the applicants array
    const applicationIndex = event.applicants.findIndex(app => app._id.toString() === applicationId);
    if (applicationIndex === -1) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update the application status
    event.applicants[applicationIndex].status = status;
    
    // If accepting the application, add to team members
    if (status.toLowerCase() === 'accepted') {
      const userId = event.applicants[applicationIndex].user;
      if (!event.team.members.includes(userId)) {
        event.team.members.push(userId);
      }

      // Handle chat group
      let chatGroup = await Chat.findOne({ eventId: event._id });
      if (!chatGroup) {
        chatGroup = new Chat({
          eventId: event._id,
          members: [event.createdBy, ...event.team.members],
          messages: [{ sender: event.createdBy, text: `Welcome to "${event.title}" chat!` }],
        });
      } else {
        if (!chatGroup.members.includes(userId)) {
          chatGroup.members.push(userId);
        }
      }
      await chatGroup.save();
    }

    await event.save();
    console.log(`Successfully updated application ${applicationId} status to ${status}`);
    res.status(200).json({ 
      message: `Application ${status} successfully updated`,
      status: status
    });
  } catch (error) {
    console.error('Error in updateApplicationStatus:', error);
    res.status(500).json({ error: 'Failed to update application status', details: error.message });
  }
};

// Get events for volunteers
const getVolunteerEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all events where the user is a team member
    const events = await Event.find({
      'team.members': userId
    }).populate('event_manager', 'name email');

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch volunteer events', error: error.message });
  }
};

// Get a specific event by ID
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('applicants.user', 'name email')
      .populate('team.members', 'name email');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Add hasApplied flag for volunteers
    const formattedEvent = {
      ...event.toObject(),
      hasApplied: event.applicants.some(
        applicant => applicant.user._id.toString() === req.user?._id?.toString()
      )
    };

    res.status(200).json(formattedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event', details: error.message });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, location, requirements } = req.body;
    const { id } = req.params;

    // Find the event
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is authorized to update this event
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    // Update event fields
    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date || event.date;
    event.location = location || event.location;
    event.requirements = requirements || event.requirements;

    // Save the updated event
    await event.save();

    res.status(200).json({ 
      message: 'Event updated successfully', 
      event 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update event', 
      details: error.message 
    });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if the user is the creator of the event
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this event" });
    }

    // Delete the event
    await Event.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error in deleteEvent:", error);
    res.status(500).json({ error: "Something went wrong", details: error.message });
  }
};

// Get volunteers for a specific event
const getEventVolunteers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('Fetching volunteers for event:', id);
    console.log('User requesting:', userId);

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    // Find the event and populate team members
    const event = await Event.findById(id)
      .populate('team.members', 'name email')
      .select('createdBy team');

    if (!event) {
      console.log('Event not found:', id);
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user is the event manager
    if (event.createdBy.toString() !== userId.toString()) {
      console.log('Unauthorized access attempt');
      return res.status(403).json({ message: "Only event managers can view volunteers" });
    }

    // Filter out the event manager from the team members
    const volunteers = event.team.members.filter(member => 
      member._id.toString() !== userId.toString()
    );

    console.log('Volunteers found:', volunteers.length);
    res.json(volunteers);
  } catch (error) {
    console.error("Error fetching event volunteers:", error);
    res.status(500).json({ message: "Failed to fetch volunteers", error: error.message });
  }
};

// Get accepted volunteers for a specific event
const getAcceptedVolunteers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('Fetching accepted volunteers for event:', id);
    console.log('User requesting:', userId);

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    // Find the event and populate user details
    const event = await Event.findById(id)
      .populate('applicants.user', 'name email');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if the requesting user is the event manager
    if (event.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to view volunteers for this event' });
    }

    // Get all volunteers with accepted status
    const acceptedVolunteers = event.applicants
      .filter(applicant => applicant.status === 'accepted')
      .map(applicant => ({
        _id: applicant.user._id,
        name: applicant.user.name,
        email: applicant.user.email,
        rating: applicant.rating || null,
        feedback: applicant.feedback || null
      }));

    console.log('Found accepted volunteers:', acceptedVolunteers.length);
    res.status(200).json(acceptedVolunteers);
  } catch (error) {
    console.error('Error in getAcceptedVolunteers:', error);
    res.status(500).json({ error: 'Failed to fetch accepted volunteers' });
  }
};

// Rate a volunteer
const rateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { volunteerId, rating, feedback } = req.body;
    const userId = req.user._id;

    console.log('Rating request received:', {
      eventId: id,
      volunteerId,
      rating,
      feedback,
      userId
    });

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(volunteerId)) {
      console.log('Invalid volunteer ID format:', volunteerId);
      return res.status(400).json({ error: 'Invalid volunteer ID format' });
    }
    if (!rating || rating < 1 || rating > 5) {
      console.log('Invalid rating value:', rating);
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Find the event and populate applicants
    const event = await Event.findById(id)
      .populate('applicants.user', '_id name email')
      .populate('createdBy', '_id name email');

    if (!event) {
      console.log('Event not found:', id);
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log('Event found:', {
      eventId: event._id,
      createdBy: event.createdBy,
      userId: userId,
      applicants: event.applicants
    });

    // Check if the requesting user is the event manager
    if (!event.createdBy || event.createdBy._id.toString() !== userId.toString()) {
      console.log('Unauthorized rating attempt:', {
        eventCreatedBy: event.createdBy?._id,
        requestingUserId: userId
      });
      return res.status(403).json({ error: 'Unauthorized to rate volunteers for this event' });
    }

    // Find the applicant in the applicants array
    const applicantIndex = event.applicants.findIndex(
      applicant => applicant.user._id.toString() === volunteerId
    );

    if (applicantIndex === -1) {
      console.log('Volunteer not found in event:', volunteerId);
      return res.status(404).json({ error: 'Volunteer not found in this event' });
    }

    // Check if volunteer is accepted
    if (event.applicants[applicantIndex].status !== 'accepted') {
      console.log('Volunteer not accepted:', {
        volunteerId,
        status: event.applicants[applicantIndex].status
      });
      return res.status(400).json({ error: 'Can only rate accepted volunteers' });
    }

    // Check if rating already exists in Rating model
    let newRating;
    const existingRating = await Rating.findOne({ volunteerId, eventId: id });
    
    if (existingRating) {
      console.log('Updating existing rating:', {
        eventId: id,
        volunteerId
      });
      
      // Update existing rating
      existingRating.rating = Number(rating);
      existingRating.feedback = feedback || '';
      existingRating.updatedAt = new Date();
      newRating = await existingRating.save();
    } else {
      console.log('Creating new rating:', {
        eventId: id,
        volunteerId
      });
      
      // Create new rating
      newRating = await Rating.create({
        volunteerId,
        eventManagerId: userId,
        eventId: id,
        rating: Number(rating),
        feedback: feedback || ''
      });
    }

    // Update the applicant's rating and feedback in the event
    event.applicants[applicantIndex].rating = Number(rating);
    event.applicants[applicantIndex].feedback = feedback || '';
    await event.save();

    // Update volunteer's ratings in User model
    const volunteer = await User.findById(volunteerId);
    if (!volunteer) {
      console.log('Volunteer not found in User model:', volunteerId);
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    const allRatings = await Rating.find({ volunteerId });
    const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
    
    // Initialize ratings object if it doesn't exist
    if (!volunteer.ratings) {
      volunteer.ratings = {
        averageRating: 0,
        totalRatings: 0,
        reviews: []
      };
    }

    // Update ratings
    volunteer.ratings.averageRating = allRatings.length > 0 ? totalRating / allRatings.length : 0;
    volunteer.ratings.totalRatings = allRatings.length;

    // Update or add review
    const reviewIndex = volunteer.ratings.reviews.findIndex(
      review => review.eventId.toString() === id
    );

    if (reviewIndex !== -1) {
      // Update existing review
      volunteer.ratings.reviews[reviewIndex] = {
        eventManagerId: userId,
        eventId: id,
        rating: Number(rating),
        review: feedback || '',
        date: new Date()
      };
    } else {
      // Add new review
      volunteer.ratings.reviews.push({
        eventManagerId: userId,
        eventId: id,
        rating: Number(rating),
        review: feedback || '',
        date: new Date()
      });
    }
    
    await volunteer.save();

    console.log('Successfully rated volunteer:', {
      eventId: id,
      volunteerId,
      rating,
      feedback
    });

    res.status(200).json({ 
      message: 'Volunteer rated successfully',
      rating: newRating
    });
  } catch (error) {
    console.error('Error in rateVolunteer:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
      requestParams: req.params,
      userId: req.user._id,
      errorName: error.name,
      errorCode: error.code
    });

    res.status(500).json({ 
      error: 'Failed to rate volunteer', 
      details: error.message
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  applyForEvent,
  getApplications,
  getMyApplications,
  updateApplicationStatus,
  getVolunteerEvents,
  getEventVolunteers,
  getAcceptedVolunteers,
  rateVolunteer
};
