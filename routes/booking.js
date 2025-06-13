const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'warehouse_picker_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000
});

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

// Helper functions
const up = s => (s ?? "").trim().toUpperCase();

// Uniform JSON wrapper functions
const ok = data => ({ success: true, data });
const err = (msg) => ({ success: false, message: msg });

// @route   GET /api/booking/ping
// @desc    Health check endpoint
// @access  Public
router.get("/ping", (_, res) => {
    console.log('🏓 Forwarder selection service ping received');
    res.json(ok("forwarder-selection-pong"));
});

// @route   GET /api/booking/options
// @desc    Get distinct value lists for autocomplete drop-downs
// @access  Public
router.get("/options", async (_, res) => {
    console.log('🎯 Fetching forwarder selection options for autocomplete...');
    
    try {
        const conn = await pool.getConnection();
        
        const [rows] = await conn.query(
            "SELECT DISTINCT destination, customer FROM forwarder_selection"
        );
        
        conn.release();

        const destinations = [...new Set(rows.map(r => up(r.destination)))].filter(Boolean).sort();
        const customers = [...new Set(rows.map(r => up(r.customer)))].filter(Boolean).sort();

        console.log(`✅ Found ${destinations.length} destinations and ${customers.length} customers`);

        res.json(ok({ destinations, customers }));
        
    } catch (error) {
        console.error('❌ Error fetching forwarder selection options:', error);
        logger.error('Error fetching forwarder selection options:', error);
        
        res.status(500).json(err("Database error while reading options"));
    }
});

// @route   GET /api/booking/forwarder
// @desc    Get forwarder selection based on criteria
// @access  Public
router.get("/forwarder", async (req, res) => {
    console.log('🔍 Searching for forwarder...');
    console.log('📋 Query parameters:', req.query);
    
    const { dest, customer, priority, dg, prepayment } = req.query;

    // Input validation
    if (!dest || !customer || !priority || !dg || !prepayment) {
        console.log('❌ Missing required query parameters');
        return res.status(400).json(
            err("Missing required parameters: dest, customer, priority, dg, prepayment")
        );
    }

    try {
        const conn = await pool.getConnection();
        
        const [rows] = await conn.execute(
            `SELECT shipping_type, carrier_cd, forwarder, remark, hyperlink
             FROM forwarder_selection
             WHERE destination = ?
               AND customer = ?
               AND priority = ?
               AND dg = ?
               AND prepayment_term = ?
             LIMIT 1`,
            [up(dest), up(customer), up(priority), up(dg), up(prepayment)]
        );
        
        conn.release();

        if (!rows.length) {
            console.log('❌ No forwarder found for given criteria');
            return res.status(404).json(err("No forwarder match found for the specified criteria"));
        }

        console.log('✅ Forwarder found:', rows[0].forwarder);
        
        logger.info(`Forwarder selected: ${rows[0].forwarder}`, {
            destination: dest,
            customer: customer,
            priority: priority
        });

        res.json(ok(rows[0]));
        
    } catch (error) {
        console.error('❌ Error during forwarder selection:', error);
        logger.error('Error during forwarder selection:', error);
        
        res.status(500).json(err("Database error during forwarder selection"));
    }
});

module.exports = router;