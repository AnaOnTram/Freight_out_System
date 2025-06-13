const { body, validationResult } = require('express-validator');

// Validate Picker Registration
const validatePickerRegistration = [
    body('forwarderName')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Forwarder name must be between 2 and 255 characters'),
    
    body('piNumber')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('PI number is required and must be less than 100 characters'),
    
    body('pickerName')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Picker name must be between 2 and 255 characters'),
    
    body('pickerContact')
        .trim()
        .matches(/^(\+852\s?)?[0-9]{8}$|^(\+852\s?)?[0-9]{4}\s?[0-9]{4}$/)
        .withMessage('Invalid Hong Kong contact number format'),
    
    body('hkidNumber')
        .trim()
        .matches(/^[A-Z]{1,2}[0-9]{6,7}$/)
        .withMessage('Invalid HKID format. Use format like A1234567 or AB123456'),
    
    body('carPlate')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('Car plate number must be less than 20 characters'),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

// Validate Shipping Order
const validateShippingOrder = [
    body('piNumber')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('PI number is required'),
    
    body('partsNumber')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Parts number is required'),
    
    body('serialNumber')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Serial number is required'),
    
    body('weight')
        .isFloat({ min: 0.01 })
        .withMessage('Weight must be a positive number'),
    
    body('length')
        .isFloat({ min: 0.01 })
        .withMessage('Length must be a positive number'),
    
    body('width')
        .isFloat({ min: 0.01 })
        .withMessage('Width must be a positive number'),
    
    body('height')
        .isFloat({ min: 0.01 })
        .withMessage('Height must be a positive number'),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        next();
    }
];

module.exports = {
    validatePickerRegistration,
    validateShippingOrder
};
