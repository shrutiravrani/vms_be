const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Auth Headers:', req.headers.authorization);
    console.log('Token:', token);

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded Token:', decoded);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log('User not found for ID:', decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('Authenticated User:', {
      id: user._id,
      role: user.role,
      email: user.email
    });

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(401).json({ message: 'Not authorized, token failed', error: error.message });
  }
};

module.exports = { protect };
