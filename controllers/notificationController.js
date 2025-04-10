const Notification = require('../models/Notification');
const User = require('../models/User');

exports.getNotifications = async (req, res) => {
  try {
    console.log('Fetching notifications for user:', req.user);
    
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    let filter = { user: req.user.id };

    if (user.role === 'volunteer' && user.filteredNotifications) {
      filter.type = 'event';
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });

    console.log('Notifications fetched:', notifications.length);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
};


// Mark notifications as read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
