const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require('fs');
const { createServer } = require('http');
const { initIo } = require('./models/socket');
require('dotenv').config();

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
  console.log('Created uploads directory');
}

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Your frontend URL
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  if (req.method === 'GET' && req.url.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, req.url);
    console.log('Static file request:', {
      url: req.url,
      path: filePath,
      exists: fs.existsSync(filePath),
      stats: fs.existsSync(filePath) ? fs.statSync(filePath) : null
    });
  }
  next();
});

// Import Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const eventRoutes = require("./routes/eventRoutes");
const reportRoutes = require("./routes/reportRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const trainingRoutes = require("./routes/trainingRoutes");

// Use Routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/training", trainingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;

// Log environment variables for debugging
console.log('Environment variables:', {
  mongoUri: process.env.MONGO_URI ? 'Present' : 'Missing',
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET ? 'Present' : 'Missing'
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
initIo(httpServer);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
