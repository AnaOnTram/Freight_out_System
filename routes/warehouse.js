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

// @route   POST /api/warehouse/shipping-order
// @desc    Create new shipping order
// @access  Public
router.post('/shipping-order', async (req, res) => {
    console.log('📦 Creating new shipping order...');
    console.log('📋 Request body:', req.body);
    
    try {
        const {
            piNumber,
            partsNumber,
            serialNumber,
            weight,
            length,
            width,
            height,
            notes
        } = req.body;
        
        // Input validation
        if (!piNumber || !partsNumber || !serialNumber || !weight || !length || !width || !height) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['piNumber', 'partsNumber', 'serialNumber', 'weight', 'length', 'width', 'height']
            });
        }
        
        // Validate numeric values
        if (isNaN(weight) || isNaN(length) || isNaN(width) || isNaN(height)) {
            return res.status(400).json({
                success: false,
                message: 'Weight and dimensions must be valid numbers'
            });
        }
        
        if (weight <= 0 || length <= 0 || width <= 0 || height <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Weight and dimensions must be positive numbers'
            });
        }
        
        console.log('✅ Input validation passed');
        
        // Check if PI number already exists
        const [existing] = await pool.execute(
            'SELECT pi_number FROM shipping_orders WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existing.length > 0) {
            console.log('❌ PI number already exists:', piNumber);
            return res.status(400).json({
                success: false,
                message: 'Shipping order with this PI number already exists'
            });
        }
        
        console.log('✅ PI number is unique');
        
        // Insert shipping order
        const [result] = await pool.execute(`
            INSERT INTO shipping_orders (
                pi_number, parts_number, serial_number, weight_kg,
                length_cm, width_cm, height_cm, picking_status,
                created_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [piNumber, partsNumber, serialNumber, weight, length, width, height]);
        
        console.log('✅ Shipping order created with PI:', piNumber);
        
        logger.info(`Shipping order created: ${piNumber}`, {
            partsNumber,
            serialNumber,
            weight
        });
        
        res.status(201).json({
            success: true,
            message: 'Shipping order created successfully',
            data: {
                piNumber,
                partsNumber,
                serialNumber,
                weight,
                dimensions: { length, width, height },
                pickingStatus: 'pending',
                createdTime: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error creating shipping order:', error);
        logger.error('Error creating shipping order:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to create shipping order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   GET /api/warehouse/shipping-orders
// @desc    Get all shipping orders with pagination and picker info
// @access  Public
router.get('/shipping-orders', async (req, res) => {
    console.log('📋 Fetching shipping orders...');
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status; // Optional filter
        
        let query = `
            SELECT s.*, p.picker_name, p.forwarder_name, p.picker_contact,
                   p.hkid_number, p.car_plate_number, p.qr_code_id, p.registration_time
            FROM shipping_orders s
            LEFT JOIN pickers p ON s.pi_number = p.pi_number
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM shipping_orders s
            LEFT JOIN pickers p ON s.pi_number = p.pi_number
        `;
        let params = [];
        
        if (status) {
            query += ' WHERE s.picking_status = ?';
            countQuery += ' WHERE s.picking_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY s.created_time DESC';
        
        // Add pagination only if requested
        if (req.query.page || req.query.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }
        
        const [rows] = await pool.execute(query, params);
        const [countResult] = await pool.execute(countQuery, status ? [status] : []);
        
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Fetched ${rows.length} shipping orders`);
        
        const orders = rows.map(order => ({
            piNumber: order.pi_number,
            partsNumber: order.parts_number,
            serialNumber: order.serial_number,
            weight: parseFloat(order.weight_kg),
            dimensions: {
                length: parseFloat(order.length_cm),
                width: parseFloat(order.width_cm),
                height: parseFloat(order.height_cm)
            },
            pickingStatus: order.picking_status,
            pickingTime: order.picking_time,
            createdTime: order.created_time,
            updatedTime: order.updated_time,
            assignedPicker: order.picker_name ? {
                pickerName: order.picker_name,
                forwarderName: order.forwarder_name,
                pickerContact: order.picker_contact,
                hkidNumber: order.hkid_number,
                carPlate: order.car_plate_number,
                qrCodeId: order.qr_code_id,
                registrationTime: order.registration_time
            } : null
        }));
        
        res.json({
            success: true,
            data: {
                orders: orders,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching shipping orders:', error);
        logger.error('Error fetching shipping orders:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shipping orders',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   GET /api/warehouse/shipping-order/:piNumber
// @desc    Get single shipping order by PI number
// @access  Public
router.get('/shipping-order/:piNumber', async (req, res) => {
    console.log('🔍 Fetching shipping order:', req.params.piNumber);
    
    try {
        const { piNumber } = req.params;
        
        const [rows] = await pool.execute(`
            SELECT s.*, p.picker_name, p.forwarder_name, p.picker_contact,
                   p.hkid_number, p.car_plate_number, p.qr_code_id, p.registration_time
            FROM shipping_orders s
            LEFT JOIN pickers p ON s.pi_number = p.pi_number
            WHERE s.pi_number = ?
        `, [piNumber]);
        
        if (rows.length === 0) {
            console.log('❌ Shipping order not found:', piNumber);
            return res.status(404).json({
                success: false,
                message: 'Shipping order not found'
            });
        }
        
        const order = rows[0];
        console.log('✅ Shipping order found:', piNumber);
        
        res.json({
            success: true,
            data: {
                shippingOrder: {
                    piNumber: order.pi_number,
                    partsNumber: order.parts_number,
                    serialNumber: order.serial_number,
                    weight: parseFloat(order.weight_kg),
                    dimensions: {
                        length: parseFloat(order.length_cm),
                        width: parseFloat(order.width_cm),
                        height: parseFloat(order.height_cm)
                    },
                    pickingStatus: order.picking_status,
                    pickingTime: order.picking_time,
                    createdTime: order.created_time,
                    updatedTime: order.updated_time
                },
                assignedPicker: order.picker_name ? {
                    pickerName: order.picker_name,
                    forwarderName: order.forwarder_name,
                    pickerContact: order.picker_contact,
                    hkidNumber: order.hkid_number,
                    carPlate: order.car_plate_number,
                    qrCodeId: order.qr_code_id,
                    registrationTime: order.registration_time
                } : null
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching shipping order:', error);
        logger.error('Error fetching shipping order:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shipping order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   PUT /api/warehouse/shipping-order/:piNumber
// @desc    Update shipping order
// @access  Public
router.put('/shipping-order/:piNumber', async (req, res) => {
    console.log('📝 Updating shipping order:', req.params.piNumber);
    console.log('📋 Update data:', req.body);
    
    try {
        const { piNumber } = req.params;
        const {
            partsNumber,
            serialNumber,
            weight,
            length,
            width,
            height
        } = req.body;
        
        // Input validation
        if (!partsNumber || !serialNumber || !weight || !length || !width || !height) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['partsNumber', 'serialNumber', 'weight', 'length', 'width', 'height']
            });
        }
        
        // Validate numeric values
        if (isNaN(weight) || isNaN(length) || isNaN(width) || isNaN(height)) {
            return res.status(400).json({
                success: false,
                message: 'Weight and dimensions must be valid numbers'
            });
        }
        
        if (weight <= 0 || length <= 0 || width <= 0 || height <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Weight and dimensions must be positive numbers'
            });
        }
        
        // Check if order exists
        const [existing] = await pool.execute(
            'SELECT pi_number FROM shipping_orders WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existing.length === 0) {
            console.log('❌ Shipping order not found:', piNumber);
            return res.status(404).json({
                success: false,
                message: 'Shipping order not found'
            });
        }
        
        // Update shipping order
        const [result] = await pool.execute(`
            UPDATE shipping_orders 
            SET parts_number = ?, serial_number = ?, weight_kg = ?,
                length_cm = ?, width_cm = ?, height_cm = ?,
                updated_time = NOW()
            WHERE pi_number = ?
        `, [partsNumber, serialNumber, weight, length, width, height, piNumber]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shipping order not found or no changes made'
            });
        }
        
        console.log('✅ Shipping order updated:', piNumber);
        
        logger.info(`Shipping order updated: ${piNumber}`, {
            partsNumber,
            serialNumber,
            weight
        });
        
        res.json({
            success: true,
            message: 'Shipping order updated successfully',
            data: {
                piNumber,
                partsNumber,
                serialNumber,
                weight,
                dimensions: { length, width, height },
                updatedTime: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating shipping order:', error);
        logger.error('Error updating shipping order:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to update shipping order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   DELETE /api/warehouse/shipping-order/:piNumber
// @desc    Delete shipping order
// @access  Public
router.delete('/shipping-order/:piNumber', async (req, res) => {
    console.log('🗑️ Deleting shipping order:', req.params.piNumber);
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { piNumber } = req.params;
        
        // Check if order exists
        const [existing] = await connection.execute(
            'SELECT pi_number FROM shipping_orders WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existing.length === 0) {
            console.log('❌ Shipping order not found:', piNumber);
            return res.status(404).json({
                success: false,
                message: 'Shipping order not found'
            });
        }
        
        // Delete related pickers first (due to foreign key constraints)
        await connection.execute('DELETE FROM pickers WHERE pi_number = ?', [piNumber]);
        
        // Delete shipping order
        const [result] = await connection.execute(
            'DELETE FROM shipping_orders WHERE pi_number = ?',
            [piNumber]
        );
        
        await connection.commit();
        
        console.log('✅ Shipping order deleted:', piNumber);
        
        logger.info(`Shipping order deleted: ${piNumber}`);
        
        res.json({
            success: true,
            message: 'Shipping order deleted successfully'
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting shipping order:', error);
        logger.error('Error deleting shipping order:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to delete shipping order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    } finally {
        connection.release();
    }
});

// @route   GET /api/warehouse/stats
// @desc    Get warehouse statistics
// @access  Public
router.get('/stats', async (req, res) => {
    console.log('📊 Fetching warehouse statistics...');
    
    try {
        // Get order statistics
        const [orderStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN picking_status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN picking_status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                SUM(CASE WHEN picking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
            FROM shipping_orders
        `);
        
        // Get picker statistics
        const [pickerStats] = await pool.execute(`
            SELECT COUNT(*) as total_pickers
            FROM pickers
        `);
        
        // Get orders with assigned pickers
        const [assignedStats] = await pool.execute(`
            SELECT COUNT(DISTINCT s.pi_number) as orders_with_pickers
            FROM shipping_orders s
            INNER JOIN pickers p ON s.pi_number = p.pi_number
        `);
        
        const stats = {
            orders: {
                total: orderStats[0].total_orders,
                pending: orderStats[0].pending_orders,
                completed: orderStats[0].completed_orders,
                cancelled: orderStats[0].cancelled_orders
            },
            pickers: {
                total: pickerStats[0].total_pickers,
                assigned: assignedStats[0].orders_with_pickers
            }
        };
        
        console.log('✅ Statistics fetched successfully');
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ Error fetching statistics:', error);
        logger.error('Error fetching warehouse statistics:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;
