// ==========================================
// DATABASE CONFIGURATION
// ==========================================

const mysql = require('mysql2/promise');

// Create basic logger if winston is not available
let logger;
try {
    logger = require('../utils/logger');
} catch (error) {
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn
    };
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'warehouse_picker_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    // Handle connection drops
    reconnect: true,
    idleTimeout: 300000,
    acquireTimeout: 60000
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        logger.info('✅ Database connected successfully');
        return true;
    } catch (error) {
        logger.error('❌ Database connection failed:', error.message);
        logger.error('Please check your database configuration in .env file');
        return false;
    }
}

// Initialize database tables if they don't exist
async function initializeTables() {
    try {
        const connection = await pool.getConnection();
        
        // Create forwarders table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS forwarders (
                forwarder_id INT PRIMARY KEY AUTO_INCREMENT,
                forwarder_name VARCHAR(255) NOT NULL UNIQUE,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                contact_email VARCHAR(255),
                contact_phone VARCHAR(50),
                status ENUM('active', 'inactive') DEFAULT 'active'
            )
        `);
        
        // Create shipping_orders table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shipping_orders (
                pi_number VARCHAR(100) PRIMARY KEY,
                parts_number VARCHAR(100) NOT NULL,
                serial_number VARCHAR(100) NOT NULL,
                weight_kg DECIMAL(10,2) NOT NULL,
                length_cm DECIMAL(8,2) NOT NULL,
                width_cm DECIMAL(8,2) NOT NULL,
                height_cm DECIMAL(8,2) NOT NULL,
                picking_status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
                picking_time TIMESTAMP NULL,
                created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create pickers table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS pickers (
                picker_id INT PRIMARY KEY AUTO_INCREMENT,
                forwarder_name VARCHAR(255) NOT NULL,
                pi_number VARCHAR(100) NOT NULL,
                picker_name VARCHAR(255) NOT NULL,
                hkid_number VARCHAR(20) NOT NULL,
                picker_contact VARCHAR(50) NOT NULL,
                car_plate_number VARCHAR(20),
                id_document_path VARCHAR(500),
                id_document_name VARCHAR(255),
                qr_code_id VARCHAR(50) UNIQUE NOT NULL,
                qr_code_path VARCHAR(500),
                registration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verification_time TIMESTAMP NULL,
                status ENUM('registered', 'verified', 'expired') DEFAULT 'registered',
                INDEX idx_pickers_qr_code (qr_code_id),
                INDEX idx_pickers_pi_number (pi_number)
            )
        `);
        
        // Create verification_logs table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS verification_logs (
                log_id INT PRIMARY KEY AUTO_INCREMENT,
                qr_code_id VARCHAR(50) NOT NULL,
                pi_number VARCHAR(100) NOT NULL,
                verification_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                gate_operator VARCHAR(255),
                verification_status ENUM('approved', 'denied') DEFAULT 'approved',
                notes TEXT,
                INDEX idx_verification_time (verification_time)
            )
        `);
        
        connection.release();
        logger.info('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        logger.error('❌ Failed to initialize database tables:', error.message);
        return false;
    }
}

// Initialize on startup
async function initialize() {
    const connected = await testConnection();
    if (connected) {
        await initializeTables();
    } else {
        logger.warn('⚠️  Database not available - some features may not work');
    }
}

// Only initialize if this file is run directly or in development
if (require.main === module || process.env.NODE_ENV === 'development') {
    initialize();
}

// Export pool and utility functions
module.exports = {
    pool,
    testConnection,
    initializeTables,
    initialize
};
