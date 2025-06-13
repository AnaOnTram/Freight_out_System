const pool = require('../config/database');
const logger = require('../utils/logger');

// Create Shipping Order
const createShippingOrder = async (req, res) => {
    try {
        const {
            piNumber,
            partsNumber,
            serialNumber,
            weight,
            length,
            width,
            height
        } = req.body;
        
        // Check if PI number already exists
        const [existing] = await pool.execute(
            'SELECT pi_number FROM shipping_orders WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Shipping order with this PI number already exists'
            });
        }
        
        // Insert shipping order
        await pool.execute(`
            INSERT INTO shipping_orders (
                pi_number, parts_number, serial_number, weight_kg,
                length_cm, width_cm, height_cm, picking_status,
                created_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [piNumber, partsNumber, serialNumber, weight, length, width, height]);
        
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
        logger.error('Error creating shipping order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create shipping order'
        });
    }
};

// Get Shipping Order
const getShippingOrder = async (req, res) => {
    try {
        const { piNumber } = req.params;
        
        const [rows] = await pool.execute(`
            SELECT s.*, p.picker_name, p.forwarder_name, p.picker_contact,
                   p.hkid_number, p.car_plate_number, p.qr_code_id
            FROM shipping_orders s
            LEFT JOIN pickers p ON s.pi_number = p.pi_number
            WHERE s.pi_number = ?
        `, [piNumber]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shipping order not found'
            });
        }
        
        const order = rows[0];
        
        res.json({
            success: true,
            data: {
                shippingOrder: {
                    piNumber: order.pi_number,
                    partsNumber: order.parts_number,
                    serialNumber: order.serial_number,
                    weight: order.weight_kg,
                    dimensions: {
                        length: order.length_cm,
                        width: order.width_cm,
                        height: order.height_cm
                    },
                    pickingStatus: order.picking_status,
                    pickingTime: order.picking_time,
                    createdTime: order.created_time
                },
                assignedPicker: order.picker_name ? {
                    pickerName: order.picker_name,
                    forwarderName: order.forwarder_name,
                    pickerContact: order.picker_contact,
                    hkidNumber: order.hkid_number,
                    carPlate: order.car_plate_number,
                    qrCodeId: order.qr_code_id
                } : null
            }
        });
        
    } catch (error) {
        logger.error('Error fetching shipping order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shipping order'
        });
    }
};

// Get All Shipping Orders (with pagination)
const getAllShippingOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const status = req.query.status; // Optional filter
        
        let query = `
            SELECT s.*, p.picker_name, p.forwarder_name, p.picker_contact
            FROM shipping_orders s
            LEFT JOIN pickers p ON s.pi_number = p.pi_number
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM shipping_orders s';
        let params = [];
        
        if (status) {
            query += ' WHERE s.picking_status = ?';
            countQuery += ' WHERE s.picking_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY s.created_time DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const [rows] = await pool.execute(query, params);
        const [countResult] = await pool.execute(countQuery, status ? [status] : []);
        
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            success: true,
            data: {
                orders: rows.map(order => ({
                    piNumber: order.pi_number,
                    partsNumber: order.parts_number,
                    serialNumber: order.serial_number,
                    weight: order.weight_kg,
                    dimensions: {
                        length: order.length_cm,
                        width: order.width_cm,
                        height: order.height_cm
                    },
                    pickingStatus: order.picking_status,
                    pickingTime: order.picking_time,
                    createdTime: order.created_time,
                    assignedPicker: order.picker_name ? {
                        pickerName: order.picker_name,
                        forwarderName: order.forwarder_name,
                        pickerContact: order.picker_contact
                    } : null
                })),
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
        
    } catch (error) {
        logger.error('Error fetching shipping orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shipping orders'
        });
    }
};

module.exports = {
    createShippingOrder,
    updateShippingOrder,
    getShippingOrder,
    getAllShippingOrders
};
