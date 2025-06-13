const pool = require('../config/database');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateQRCodeId, processUploadedFile } = require('../utils/helpers');

// Register Picker
const registerPicker = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const {
            forwarderName,
            piNumber,
            pickerName,
            pickerContact,
            hkidNumber,
            carPlate
        } = req.body;
        
        // Check if PI number already exists
        const [existingPicker] = await connection.execute(
            'SELECT pi_number FROM pickers WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existingPicker.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'A picker is already registered for this PI number'
            });
        }
        
        // Process uploaded file
        let documentPath = null;
        let documentName = null;
        
        if (req.file) {
            const processedFile = await processUploadedFile(req.file);
            documentPath = processedFile.path;
            documentName = processedFile.originalName;
        }
        
        // Generate unique QR code ID
        const qrCodeId = generateQRCodeId();
        
        // Insert forwarder if not exists
        await connection.execute(
            `INSERT IGNORE INTO forwarders (forwarder_name, registration_date) 
             VALUES (?, NOW())`,
            [forwarderName]
        );
        
        // Generate QR code
        const verificationUrl = `${process.env.FRONTEND_URL}/gate-verification.html?qr=${qrCodeId}`;
        const qrCodePath = path.join(__dirname, '../qr-codes', `${qrCodeId}.png`);
        
        // Ensure QR codes directory exists
        await fs.mkdir(path.dirname(qrCodePath), { recursive: true });
        
        // Generate QR code image
        await QRCode.toFile(qrCodePath, verificationUrl, {
            width: 300,
            height: 300,
            margin: 3,
            color: {
                dark: '#2c3e50',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });
        
        // Calculate expiry time (24 hours from now)
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Insert picker record
        const [result] = await connection.execute(`
            INSERT INTO pickers (
                forwarder_name, pi_number, picker_name, hkid_number, 
                picker_contact, car_plate_number, id_document_path, 
                id_document_name, qr_code_id, qr_code_path, 
                registration_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'registered')
        `, [
            forwarderName, piNumber, pickerName, hkidNumber,
            pickerContact, carPlate || null, documentPath,
            documentName, qrCodeId, qrCodePath
        ]);
        
        await connection.commit();
        
        // Log successful registration
        logger.info(`Picker registered successfully: ${qrCodeId}`, {
            piNumber,
            forwarderName,
            pickerName
        });
        
        res.status(201).json({
            success: true,
            message: 'Picker registered successfully',
            data: {
                pickerId: result.insertId,
                qrCodeId,
                piNumber,
                verificationUrl,
                qrCodePath: `/qr-codes/${qrCodeId}.png`,
                expiryTime: expiryTime.toISOString(),
                registrationTime: new Date().toISOString()
            }
        });
        
    } catch (error) {
        await connection.rollback();
        logger.error('Error registering picker:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to register picker',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    } finally {
        connection.release();
    }
};

// Get Picker by PI Number
const getPickerByPI = async (req, res) => {
    try {
        const { piNumber } = req.params;
        
        const [rows] = await pool.execute(`
            SELECT p.*, s.parts_number, s.serial_number, s.weight_kg, 
                   s.length_cm, s.width_cm, s.height_cm, s.picking_status,
                   s.picking_time, s.created_time
            FROM pickers p
            LEFT JOIN shipping_orders s ON p.pi_number = s.pi_number
            WHERE p.pi_number = ?
        `, [piNumber]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Picker not found'
            });
        }
        
        const picker = rows[0];
        
        res.json({
            success: true,
            data: {
                picker: {
                    pickerId: picker.picker_id,
                    forwarderName: picker.forwarder_name,
                    piNumber: picker.pi_number,
                    pickerName: picker.picker_name,
                    pickerContact: picker.picker_contact,
                    hkidNumber: picker.hkid_number,
                    carPlate: picker.car_plate_number,
                    qrCodeId: picker.qr_code_id,
                    registrationTime: picker.registration_time,
                    status: picker.status
                },
                shippingOrder: picker.parts_number ? {
                    partsNumber: picker.parts_number,
                    serialNumber: picker.serial_number,
                    weight: picker.weight_kg,
                    dimensions: {
                        length: picker.length_cm,
                        width: picker.width_cm,
                        height: picker.height_cm
                    },
                    pickingStatus: picker.picking_status,
                    pickingTime: picker.picking_time,
                    createdTime: picker.created_time
                } : null
            }
        });
        
    } catch (error) {
        logger.error('Error fetching picker:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch picker data'
        });
    }
};

// Update Picker Status
const updatePickerStatus = async (req, res) => {
    try {
        const { piNumber } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['registered', 'verified', 'expired'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }
        
        const [result] = await pool.execute(
            'UPDATE pickers SET status = ? WHERE pi_number = ?',
            [status, piNumber]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Picker not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Picker status updated successfully'
        });
        
    } catch (error) {
        logger.error('Error updating picker status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update picker status'
        });
    }
};

module.exports = {
    registerPicker,
    getPickerByPI,
    updatePickerStatus
};
