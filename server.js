// ==========================================
// BASIC SERVER.JS - WAREHOUSE PICKER API
// ==========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create basic logger if winston is not available
let logger;
try {
    logger = require('./utils/logger');
} catch (error) {
    // Fallback logger
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn
    };
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/booking-forms', express.static(path.join(__dirname, 'booking_form')));

app.get('/forwarder.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forwarder.html'));
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/qr-codes', express.static(path.join(__dirname, 'qr-codes')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Warehouse Picker API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// Basic test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working correctly',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Load routes if they exist
try {
    const forwarderRoutes = require('./routes/forwarder');
    app.use('/api/forwarder', forwarderRoutes);
    logger.info('Forwarder routes loaded');
} catch (error) {
    logger.warn('Forwarder routes not found, skipping...');
}

// Add booking routes (for forwarder selection functionality)
try {
    const bookingRoutes = require('./routes/booking');
    app.use('/api/booking', bookingRoutes);
    logger.info('Booking routes loaded');
} catch (error) {
    logger.warn('Booking routes not found, skipping...');
}

// Add selector routes (alternative endpoint for forwarder selection)
try {
    const selectorRoutes = require('./routes/selector');
    app.use('/api/selector', selectorRoutes);
    logger.info('Selector routes loaded');
} catch (error) {
    logger.warn('Selector routes not found, skipping...');
}

try {
    const warehouseRoutes = require('./routes/warehouse');
    app.use('/api/warehouse', warehouseRoutes);
    logger.info('Warehouse routes loaded');
} catch (error) {
    logger.warn('Warehouse routes not found, skipping...');
}

try {
    const verificationRoutes = require('./routes/verification');
    app.use('/api/verification', verificationRoutes);
    logger.info('Verification routes loaded');
} catch (error) {
    logger.warn('Verification routes not found, skipping...');
}

try {
    const dashboardRoutes = require('./routes/dashboard');
    app.use('/api/dashboard', dashboardRoutes);
    logger.info('Dashboard routes loaded');
} catch (error) {
    logger.warn('Dashboard routes not found, skipping...');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Warehouse Picker API server running on port ${PORT}`);
    logger.info(`📊 Health check: http://0.0.0.0:${PORT}/api/health`);
    logger.info(`🧪 Test endpoint: http://0.0.0.0:${PORT}/api/test`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;