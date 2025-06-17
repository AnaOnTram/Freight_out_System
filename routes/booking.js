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

// @route   GET /api/booking/destinations
// @desc    Get all unique destinations with city names for blur search
// @access  Public
router.get("/destinations", async (req, res) => {
    console.log('🎯 Fetching destinations for blur search...');
    
    const { query } = req.query;
    
    try {
        const conn = await pool.getConnection();
        
        let sql = `
            SELECT DISTINCT destination, city_name
            FROM forwarder_selection 
            WHERE destination IS NOT NULL AND destination != ''
        `;
        
        let params = [];
        
        // Add search filter if query provided
        if (query && query.trim()) {
            const searchTerm = `%${query.trim()}%`;
            sql += ` AND (
                UPPER(destination) LIKE UPPER(?) OR 
                UPPER(city_name) LIKE UPPER(?)
            )`;
            params = [searchTerm, searchTerm];
        }
        
        sql += ` ORDER BY destination`;
        
        const [rows] = await conn.execute(sql, params);
        conn.release();

        // Format destinations for autocomplete
        const destinations = rows.map(row => {
            if (row.city_name) {
                return {
                    code: row.destination,
                    city: row.city_name,
                    display: `${row.city_name} (${row.destination})`,
                    value: row.destination
                };
            } else {
                return {
                    code: row.destination,
                    city: null,
                    display: row.destination,
                    value: row.destination
                };
            }
        });

        console.log(`✅ Found ${destinations.length} destinations`);

        res.json(ok({ destinations }));
        
    } catch (error) {
        console.error('❌ Error fetching destinations:', error);
        logger.error('Error fetching destinations:', error);
        
        res.status(500).json(err("Database error while reading destinations"));
    }
});

// @route   GET /api/booking/customers-by-destination
// @desc    Get customers filtered by destination
// @access  Public
router.get("/customers-by-destination", async (req, res) => {
    console.log('🎯 Fetching customers by destination...');
    
    const { destination } = req.query;
    
    if (!destination) {
        return res.status(400).json(err("Destination parameter is required"));
    }
    
    try {
        const searchDestination = up(destination);
        
        console.log(`🔍 Searching customers for destination: ${searchDestination}`);
        
        const conn = await pool.getConnection();
        
        const [rows] = await conn.execute(
            "SELECT DISTINCT customer FROM forwarder_selection WHERE destination = ? ORDER BY customer",
            [searchDestination]
        );
        
        conn.release();

        const customers = rows.map(r => up(r.customer)).filter(Boolean);

        console.log(`✅ Found ${customers.length} customers for destination ${searchDestination}`);

        res.json(ok({ 
            destination: searchDestination,
            customers: customers
        }));
        
    } catch (error) {
        console.error('❌ Error fetching customers by destination:', error);
        logger.error('Error fetching customers by destination:', error);
        
        res.status(500).json(err("Database error while fetching customers"));
    }
});

// @route   GET /api/booking/special-remarks
// @desc    Get records with special conditions (no city name or special remarks)
// @access  Public
router.get("/special-remarks", async (_, res) => {
    console.log('⚠️ Fetching special remarks and unmapped destinations...');
    
    try {
        const conn = await pool.getConnection();
        
        // Get records without city names
        const [unmappedDestinations] = await conn.execute(`
            SELECT DISTINCT destination, COUNT(*) as record_count
            FROM forwarder_selection 
            WHERE city_name IS NULL OR city_name = ''
            GROUP BY destination
            ORDER BY destination
        `);
        
        // Get records with non-empty remarks
        const [specialRemarks] = await conn.execute(`
            SELECT DISTINCT destination, city_name, remark, customer, forwarder, COUNT(*) as record_count
            FROM forwarder_selection 
            WHERE remark IS NOT NULL AND remark != '' AND remark != 'None'
            GROUP BY destination, city_name, remark, customer, forwarder
            ORDER BY destination, customer
            LIMIT 50
        `);
        
        // Get summary statistics
        const [totalRecords] = await conn.execute(
            'SELECT COUNT(*) as total FROM forwarder_selection'
        );
        
        const [mappedRecords] = await conn.execute(
            'SELECT COUNT(*) as mapped FROM forwarder_selection WHERE city_name IS NOT NULL AND city_name != ""'
        );
        
        conn.release();

        const summary = {
            totalRecords: totalRecords[0].total,
            mappedRecords: mappedRecords[0].mapped,
            unmappedRecords: totalRecords[0].total - mappedRecords[0].mapped,
            unmappedDestinations: unmappedDestinations.length,
            specialRemarksCount: specialRemarks.length
        };

        console.log(`✅ Found ${unmappedDestinations.length} unmapped destinations and ${specialRemarks.length} special remarks`);

        res.json(ok({ 
            summary,
            unmappedDestinations,
            specialRemarks
        }));
        
    } catch (error) {
        console.error('❌ Error fetching special remarks:', error);
        logger.error('Error fetching special remarks:', error);
        
        res.status(500).json(err("Database error while fetching special remarks"));
    }
});

// @route   GET /api/booking/options
// @desc    Get distinct value lists for autocomplete drop-downs (legacy support)
// @access  Public
router.get("/options", async (_, res) => {
    console.log('🎯 Fetching forwarder selection options for autocomplete...');
    
    try {
        const conn = await pool.getConnection();
        
        const [rows] = await conn.query(
            `SELECT DISTINCT destination, city_name, customer 
             FROM forwarder_selection 
             WHERE destination IS NOT NULL AND destination != ''`
        );
        
        conn.release();

        // Process destinations - include both airport codes and city names
        const destinationSet = new Set();
        const customerSet = new Set();
        
        rows.forEach(row => {
            const dest = up(row.destination);
            const customer = up(row.customer);
            
            if (dest) {
                destinationSet.add(dest);
                
                // Add city name if available
                if (row.city_name) {
                    destinationSet.add(`${row.city_name} (${dest})`);
                }
            }
            
            if (customer) {
                customerSet.add(customer);
            }
        });

        const destinations = Array.from(destinationSet).sort();
        const customers = Array.from(customerSet).sort();

        console.log(`✅ Found ${destinations.length} destination options and ${customers.length} customers`);

        res.json(ok({ 
            destinations, 
            customers
        }));
        
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
        // Extract IATA code if input contains city name format "City (CODE)"
        let searchDestination = up(dest);
        const codeMatch = dest.match(/\(([A-Z]{3})\)$/);
        if (codeMatch) {
            searchDestination = codeMatch[1];
            console.log(`🌆 Extracted IATA code "${searchDestination}" from input "${dest}"`);
        }
        
        const conn = await pool.getConnection();
        
        const [rows] = await conn.execute(
            `SELECT shipping_type, carrier_cd, forwarder, remark, hyperlink, destination, city_name
             FROM forwarder_selection
             WHERE destination = ?
               AND customer = ?
               AND priority = ?
               AND dg = ?
               AND prepayment_term = ?
             LIMIT 1`,
            [searchDestination, up(customer), up(priority), up(dg), up(prepayment)]
        );
        
        conn.release();

        if (!rows.length) {
            console.log(`❌ No forwarder found for criteria: ${searchDestination}, ${customer}, ${priority}, ${dg}, ${prepayment}`);
            return res.status(404).json(err("No forwarder match found for the specified criteria"));
        }

        console.log('✅ Forwarder found:', rows[0].forwarder);
        
        logger.info(`Forwarder selected: ${rows[0].forwarder}`, {
            destination: searchDestination,
            cityName: rows[0].city_name,
            originalDestination: dest,
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
