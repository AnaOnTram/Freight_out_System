const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');
const fs = require('fs').promises;

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '011209',
    database: process.env.DB_NAME || 'warehouse_picker_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000
});

// Configure file upload
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/id-documents');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `id-document-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        console.log('📄 File upload attempt:', file.originalname, file.mimetype);
        
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            console.log('✅ File type approved');
            return cb(null, true);
        } else {
            console.log('❌ File type rejected');
            cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
        }
    }
});

// Generate unique QR Code ID
function generateQRCodeId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `WH${timestamp}${random}`;
}

// Validate HKID format
function validateHKID(hkid) {
    const pattern = /^[A-Z]{1,2}[0-9]{6,7}$/;
    return pattern.test(hkid);
}

// Validate Hong Kong phone number
function validateHKPhone(phone) {
    const pattern = /^(\+852\s?)?[0-9]{8}$|^(\+852\s?)?[0-9]{4}\s?[0-9]{4}$/;
    return pattern.test(phone);
}

// @route   POST /api/forwarder/register-picker
// @desc    Register new picker with QR code generation
// @access  Public
router.post('/register-picker', upload.single('idDocument'), async (req, res) => {
    console.log('🚀 Starting picker registration...');
    console.log('📋 Request body:', req.body);
    console.log('📄 Uploaded file:', req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
    } : 'No file uploaded');
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        console.log('🔄 Database transaction started');
        
        const {
            forwarderName,
            piNumber,
            pickerName,
            pickerContact,
            hkidNumber,
            carPlate
        } = req.body;
        
        // Input validation
        console.log('🔍 Validating input data...');
        
        if (!forwarderName || !piNumber || !pickerName || !pickerContact || !hkidNumber) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['forwarderName', 'piNumber', 'pickerName', 'pickerContact', 'hkidNumber']
            });
        }
        
        // Validate HKID format
        const cleanHKID = hkidNumber.trim().toUpperCase();
        if (!validateHKID(cleanHKID)) {
            console.log('❌ Invalid HKID format:', cleanHKID);
            return res.status(400).json({
                success: false,
                message: 'Invalid HKID format. Use format like A1234567 or AB123456'
            });
        }
        
        // Validate phone number
        if (!validateHKPhone(pickerContact)) {
            console.log('❌ Invalid phone format:', pickerContact);
            return res.status(400).json({
                success: false,
                message: 'Invalid Hong Kong phone number format'
            });
        }
        
        console.log('✅ Input validation passed');
        
        // Check if PI number already exists
        console.log('🔍 Checking for existing PI number...');
        const [existingPicker] = await connection.execute(
            'SELECT pi_number FROM pickers WHERE pi_number = ?',
            [piNumber]
        );
        
        if (existingPicker.length > 0) {
            console.log('❌ PI number already exists:', piNumber);
            return res.status(400).json({
                success: false,
                message: 'A picker is already registered for this PI number'
            });
        }
        
        console.log('✅ PI number is unique');
        
        // Generate unique QR code ID
        const qrCodeId = generateQRCodeId();
        console.log('🆔 Generated QR Code ID:', qrCodeId);
        
        // Handle uploaded file
        let documentPath = null;
        let documentName = null;
        
        if (req.file) {
            documentPath = req.file.path;
            documentName = req.file.originalname;
            console.log('📄 File saved to:', documentPath);
        } else {
            console.log('⚠️ No file uploaded');
        }
        
        // Insert forwarder if not exists
        console.log('👥 Checking/inserting forwarder...');
        await connection.execute(
            `INSERT IGNORE INTO forwarders (forwarder_name, registration_date) 
             VALUES (?, NOW())`,
            [forwarderName]
        );
        console.log('✅ Forwarder processed');
        
        // Generate QR code image
        console.log('🎨 Generating QR code...');
        const verificationUrl = `${req.protocol}://${req.get('host')}/verification.html?qr=${qrCodeId}`;
        const qrCodeDir = path.join(__dirname, '../qr-codes');
        const qrCodePath = path.join(qrCodeDir, `${qrCodeId}.png`);
        
        // Ensure QR codes directory exists
        await fs.mkdir(qrCodeDir, { recursive: true });
        
        // Generate QR code file
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
        
        console.log('✅ QR code generated:', qrCodePath);
        
        // Calculate expiry time (24 hours from now)
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Insert picker record
        console.log('💾 Inserting picker record...');
        const [result] = await connection.execute(`
            INSERT INTO pickers (
                forwarder_name, pi_number, picker_name, hkid_number, 
                picker_contact, car_plate_number, id_document_path, 
                id_document_name, qr_code_id, qr_code_path, 
                registration_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'registered')
        `, [
            forwarderName, 
            piNumber, 
            pickerName, 
            cleanHKID,
            pickerContact, 
            carPlate || null, 
            documentPath,
            documentName, 
            qrCodeId, 
            qrCodePath
        ]);
        
        console.log('✅ Picker record inserted with ID:', result.insertId);
        
        await connection.commit();
        console.log('✅ Transaction committed successfully');
        
        // Log successful registration
        console.log(`🎉 Picker registered successfully: ${qrCodeId}`, {
            pickerId: result.insertId,
            piNumber,
            forwarderName,
            pickerName
        });
        
        // Return success response
        const qrDataURL = await QRCode.toDataURL(verificationUrl, {
            width: 300,
            height: 300,
            margin: 3,
            color: {
                dark: '#2c3e50',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });

        console.log('✅ QR code generated as base64');

        // Return success response with base64 QR code
        res.status(201).json({
            success: true,
            message: 'Picker registered successfully',
            data: {
                pickerId: result.insertId,
                qrCodeId,
                piNumber,
                verificationUrl,
                qrCodePath: `/qr-codes/${qrCodeId}.png`,
                qrCodeBase64: qrDataURL, // Add this line
                expiryTime: expiryTime.toISOString(),
                registrationTime: new Date().toISOString()
            }
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error registering picker:', error);
        
        // Clean up uploaded file if registration failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
                console.log('🧹 Cleaned up uploaded file due to error');
            } catch (cleanupError) {
                console.error('⚠️ Could not clean up uploaded file:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to register picker',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    } finally {
        connection.release();
    }
});

// @route   GET /api/forwarder/test-db
// @desc    Test database connection
// @access  Public
router.get('/test-db', async (req, res) => {
    try {
        console.log('🧪 Testing database connection...');
        
        // Test basic connection
        const [rows] = await pool.execute('SELECT 1 as test');
        console.log('✅ Basic connection test passed');
        
        // Test tables exist
        const [tables] = await pool.execute('SHOW TABLES');
        console.log('📊 Available tables:', tables.map(t => Object.values(t)[0]));
        
        // Test table structures
        const [pickersCols] = await pool.execute('DESCRIBE pickers');
        console.log('🏗️ Pickers table structure verified');
        
        res.json({
            success: true,
            message: 'Database connection successful',
            data: {
                connectionTest: 'passed',
                tables: tables.map(t => Object.values(t)[0]),
                pickersColumns: pickersCols.map(col => col.Field)
            }
        });
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

module.exports = router;
