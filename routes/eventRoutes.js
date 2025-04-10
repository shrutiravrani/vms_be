const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/EventController');
const { protect } = require('../middlewares/authMiddleware');

// All routes are protected
router.use(protect);

// Route to create an event
router.post('/', createEvent);

// Route to fetch all events
router.get('/', getEvents);

// Route to fetch events created by the event manager
router.get('/created', getEvents);

// Route to get volunteers for a specific event
router.get('/:id/volunteers', getEventVolunteers);

// Route to get a specific event
router.get('/:id', getEventById);

// Route to update an event
router.put('/:id', updateEvent);

// Route to delete an event
router.delete('/:id', deleteEvent);

// Route to apply for an event
router.post('/:id/apply', applyForEvent);

// Route to get applications for an event
router.get('/:id/applications', getApplications);

// Route to get my applications
router.get('/my-applications', getMyApplications);

// Route to update application status
router.put('/:id/applications/:applicationId', updateApplicationStatus);

// Route to get volunteer events
router.get('/volunteer/events', getVolunteerEvents);

// Route to get accepted volunteers for an event
router.get('/:id/accepted-volunteers', getAcceptedVolunteers);

// Route to rate a volunteer
router.post('/:id/rate', rateVolunteer);

module.exports = router;
