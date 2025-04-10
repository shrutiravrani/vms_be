const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Event = require('../models/Event');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const Rating = require('../models/Rating');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
}).single('profileImage');

// Get all users (for testing)
const getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Connect two users
const connectUser = async (req, res) => {
  try {
    const user = await User.findById(req.body.userId); // ID of the logged-in user
    const connectUser = await User.findById(req.params.id); // ID of the user to connect

    if (!connectUser) return res.status(404).json({ message: 'User not found' });

    if (!user.connections.includes(connectUser._id)) {
      user.connections.push(connectUser._id);
      connectUser.connections.push(user._id);
      await user.save();
      await connectUser.save();
    }

    res.json({ message: 'Connected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update User Profile
const updateUserProfile = async (req, res) => {
  try {
    console.log('Received profile update request with data:', req.body);
    
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      name,
      bio,
      profileImage,
      keySkills,
      experience,
      availability,
      preferredEventTypes,
      achievements,
      certifications
    } = req.body;

    console.log('Current user data:', {
      name: user.name,
      role: user.role,
      hasKeySkills: !!user.keySkills,
      hasExperience: !!user.experience,
      hasAvailability: !!user.availability
    });

    // Update basic info
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (profileImage) user.profileImage = profileImage;

    // Update volunteer specific fields if user is a volunteer
    if (user.role === 'volunteer') {
      // Always initialize arrays if they don't exist
      user.keySkills = user.keySkills || [];
      user.experience = user.experience || [];
      user.achievements = user.achievements || [];
      user.certifications = user.certifications || [];
      user.preferredEventTypes = user.preferredEventTypes || [];
      
      // Update arrays if provided in request
      if (Array.isArray(keySkills)) {
        console.log('Updating keySkills:', keySkills);
        user.keySkills = keySkills;
      }
      
      if (Array.isArray(experience)) {
        console.log('Updating experience:', experience);
        user.experience = experience;
      }
      
      if (availability) {
        console.log('Updating availability:', availability);
        user.availability = {
          weekdays: availability.weekdays ?? user.availability?.weekdays ?? true,
          weekends: availability.weekends ?? user.availability?.weekends ?? true,
          specificDays: Array.isArray(availability.specificDays) ? availability.specificDays : user.availability?.specificDays || []
        };
      }
      
      if (Array.isArray(preferredEventTypes)) {
        console.log('Updating preferredEventTypes:', preferredEventTypes);
        user.preferredEventTypes = preferredEventTypes;
      }
      
      if (Array.isArray(achievements)) {
        console.log('Updating achievements:', achievements);
        user.achievements = achievements;
      }
      
      if (Array.isArray(certifications)) {
        console.log('Updating certifications:', certifications);
        user.certifications = certifications;
      }

      // Initialize ratings if they don't exist
      if (!user.ratings) {
        user.ratings = {
          averageRating: 0,
          totalRatings: 0,
          reviews: []
        };
      }

      // Initialize eventsParticipated if it doesn't exist
      if (!user.eventsParticipated) {
        user.eventsParticipated = {
          total: 0,
          completed: 0,
          ongoing: 0
        };
      }
    }

    console.log('Saving updated user with data:', {
      name: user.name,
      role: user.role,
      keySkills: user.keySkills?.length,
      experience: user.experience?.length,
      achievements: user.achievements?.length,
      certifications: user.certifications?.length
    });

    const updatedUser = await user.save();
    console.log('User saved successfully');

    // Return all fields in response
    const responseData = {
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        bio: updatedUser.bio || '',
        profileImage: updatedUser.profileImage || '',
        keySkills: updatedUser.keySkills || [],
        experience: updatedUser.experience || [],
        availability: updatedUser.availability || {
          weekdays: true,
          weekends: true,
          specificDays: []
        },
        preferredEventTypes: updatedUser.preferredEventTypes || [],
        eventsParticipated: updatedUser.eventsParticipated || {
          total: 0,
          completed: 0,
          ongoing: 0
        },
        ratings: updatedUser.ratings || {
          averageRating: 0,
          totalRatings: 0,
          reviews: []
        },
        achievements: updatedUser.achievements || [],
        certifications: updatedUser.certifications || []
      }
    };

    console.log('Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Upload Profile Image
const uploadProfileImage = async (req, res) => {
  try {
  upload(req, res, async function (err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ message: 'Please upload a file' });
    }

      // Get the user
      const user = await User.findById(req.user.id);
      if (!user) {
        // Delete the uploaded file if user not found
            fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete old profile image if exists
      if (user.profileImage) {
        const oldImagePath = path.join(uploadDir, path.basename(user.profileImage));
        if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
        }
      }

      // Update user's profile image path
      user.profileImage = `/uploads/${req.file.filename}`;
      await user.save();

      res.json({
        message: 'Profile image uploaded successfully',
        imageUrl: user.profileImage
      });
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
      res.status(500).json({ message: error.message });
    }
};

// Get specific volunteer's profile
const getVolunteerProfile = async (req, res) => {
  try {
    const volunteer = await User.findById(req.params.id)
      .select('-password -resetToken -resetTokenExpiry -resetPasswordToken -resetPasswordExpire');

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Get recent reviews from Rating model
    const recentReviews = await Rating.find({ volunteerId: volunteer._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('eventManagerId', 'name profileImage')
      .populate('eventId', 'title date');

    // Calculate average rating from Rating model
    const ratingStats = await Rating.aggregate([
      {
        $match: { volunteerId: volunteer._id }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    // Calculate accepted events count
    const now = new Date();
    const acceptedEvents = await Event.find({
      'applicants': {
        $elemMatch: {
          user: volunteer._id,
          status: 'accepted'
        }
      }
    });

    // Update eventsParticipated counts
    volunteer.eventsParticipated = {
      total: acceptedEvents.length,
      completed: acceptedEvents.filter(event => new Date(event.date) < now).length,
      ongoing: acceptedEvents.filter(event => new Date(event.date) >= now).length
    };

    // Add ratings and reviews to the response
    volunteer.ratings = {
      averageRating: ratingStats[0]?.averageRating || 0,
      totalRatings: ratingStats[0]?.totalRatings || 0,
      reviews: recentReviews.map(review => ({
        rating: review.rating,
        feedback: review.feedback,
        createdAt: review.createdAt,
        eventTitle: review.eventId?.title,
        eventDate: review.eventId?.date,
        reviewerName: review.eventManagerId?.name,
        reviewerImage: review.eventManagerId?.profileImage
      }))
    };

    res.json(volunteer);
  } catch (error) {
    console.error('Get volunteer profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get specific volunteer's profile by username
const getVolunteerProfileByUsername = async (req, res) => {
  try {
    const volunteer = await User.findOne({ 
      username: req.params.username,
      role: 'volunteer'
    })
    .select('-password -resetToken -resetTokenExpiry -resetPasswordToken -resetPasswordExpire')
    .populate('ratings.reviews.eventManagerId', 'name profileImage')
    .populate('ratings.reviews.eventId', 'title date');

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Calculate average rating
    if (volunteer.ratings && volunteer.ratings.reviews) {
      const totalRating = volunteer.ratings.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      volunteer.ratings.averageRating = volunteer.ratings.reviews.length > 0 
        ? totalRating / volunteer.ratings.reviews.length 
        : 0;
      volunteer.ratings.totalRatings = volunteer.ratings.reviews.length;
    }

    // Calculate accepted events count
    const now = new Date();
    const acceptedEvents = await Event.find({
      'applicants': {
        $elemMatch: {
          user: volunteer._id,
          status: 'accepted'
        }
      }
    });

    // Update eventsParticipated counts
    volunteer.eventsParticipated = {
      total: acceptedEvents.length,
      completed: acceptedEvents.filter(event => new Date(event.date) < now).length,
      ongoing: acceptedEvents.filter(event => new Date(event.date) >= now).length
    };

    res.json(volunteer);
  } catch (error) {
    console.error('Get volunteer profile by username error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Export all functions together
module.exports = {
  getUsers,
  connectUser,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  getVolunteerProfile,
  getVolunteerProfileByUsername,
  registerUser: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // Check if user already exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Create new user with initialized fields
      const user = await User.create({
        name,
        email,
        password, // Password will be hashed in the User model pre-save hook
        role: role || 'volunteer', // Default to volunteer if no role specified
        keySkills: [],
        experience: [],
        availability: {
          weekdays: true,
          weekends: true,
          specificDays: []
        },
        preferredEventTypes: [],
        eventsParticipated: {
          total: 0,
          completed: 0,
          ongoing: 0
        },
        ratings: {
          averageRating: 0,
          totalRatings: 0,
          reviews: []
        },
        achievements: [],
        certifications: []
      });

      if (user) {
        res.status(201).json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user', details: error.message });
    }
  },

  loginUser: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      
      // Check if user exists and password matches
      if (user && (await user.matchPassword(password))) {
        res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        });
      } else {
        res.status(401).json({ error: 'Invalid email or password' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login', details: error.message });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // Token expires in 10 minutes

      await user.save();

      // In a real application, you would send this token via email
      res.json({ 
        message: 'Password reset token generated',
        resetToken // In production, send this via email instead
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process forgot password request' });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { password } = req.body;
      const { token } = req.params;

      // Find user by reset token and check if token is expired
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Update password
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
};
