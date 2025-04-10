const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Signup Functionality
const signup = async (req, res) => {
  try {
    const { name, email, password, role, bio, interestedSkills } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create the user
    const user = await User.create({
      name,
      email,
      password,
      role,
      bio,
      interestedSkills: role === 'volunteer' ? interestedSkills || [] : [], // Only for volunteers
    });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Return the response
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        interestedSkills: user.interestedSkills,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// Login Functionality
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords using the model's method
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Return the response
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        interestedSkills: user.interestedSkills,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};




module.exports = { signup, login };
