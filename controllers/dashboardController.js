const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');

const getDashboardData = async (req, res) => {
  try {
    if (!req.user) {
      console.error('ERROR: No user found in request');
      return res.status(401).json({ message: 'Not authorized' });
    }

    console.log(' Dashboard Controller: Request User:', req.user);
    const { role, _id } = req.user;

    // Count unread notifications
    const unreadNotificationsCount = await Notification.countDocuments({ user: _id, isRead: false });

    let data = { notificationsCount: unreadNotificationsCount };

    if (role === 'volunteer') {
      console.log('Fetching data for volunteer...');
      // Find all events where the volunteer's application is accepted
      const joinedEvents = await Event.find({
        'applicants': {
          $elemMatch: {
            user: _id,
            status: 'accepted'
          }
        }
      })
      .select('title date location description imageUrl')
      .sort({ date: 1 }); // Sort by date ascending

      const now = new Date();
      const upcomingEvents = joinedEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now;
      });
      
      data = { 
        ...data, 
        eventsCount: joinedEvents.length, // Total accepted events (both past and upcoming)
        upcomingEvents: upcomingEvents.map(event => ({
          ...event.toObject(),
          date: event.date.toISOString() // Ensure consistent date format
        }))
      };

      console.log('Dashboard Data for Volunteer:', {
        totalEvents: joinedEvents.length,
        upcomingEvents: upcomingEvents.length,
        events: data.upcomingEvents
      });
    } else if (role === 'event_manager') {
      console.log('Fetching data for event manager...');
      const createdEvents = await Event.find({ createdBy: _id })
        .select('title date applicants')
        .sort({ date: -1 }); // Sort by date descending

      const pendingApplications = createdEvents.reduce((count, event) => {
        return count + event.applicants.filter(app => app.status === 'pending').length;
      }, 0);

      data = { ...data, eventsCount: createdEvents.length, pendingApplications };
    }

    console.log(' Dashboard Data:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error(' Dashboard Error:', error.message);
    res.status(500).json({ error: 'Failed to load dashboard data', details: error.message });
  }
};

module.exports = { getDashboardData };
