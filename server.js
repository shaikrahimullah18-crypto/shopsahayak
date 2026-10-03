require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Handlers
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');

// Initialize Express App
const app = express();

// Connect to MongoDB Atlas
connectDB();

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from workspace root
app.use(express.static(path.join(__dirname)));

// API Route Mounts
app.use('/api/store', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ShopSahayak AI Retail Assistant API',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// Root Route - Serves index.html or welcome message
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [ShopSahayak] Server running on http://localhost:${PORT}`);
  console.log(`📦 [ShopSahayak] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ [ShopSahayak] Health Check: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] Error: ${err.message}`);
  // Keep server running in dev mode
});

module.exports = app;
