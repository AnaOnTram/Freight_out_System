const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Generate QR Code ID
const generateQRCodeId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `WH${timestamp}${random}`;
};

// Process uploaded file (compress images, validate PDFs)
const processUploadedFile = async (file) => {
    try {
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            // Compress image
            const compressedPath = file.path.replace(ext, `_compressed${ext}`);
            
            await sharp(file.path)
                .resize(1200, 1200, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 85 })
                .toFile(compressedPath);
            
            // Remove original file
            await fs.unlink(file.path);
            
            return {
                path: compressedPath,
                originalName: file.originalname,
                size: (await fs.stat(compressedPath)).size
            };
        } else {
            // For PDFs, just return the path
            return {
                path: file.path,
                originalName: file.originalname,
                size: file.size
            };
        }
    } catch (error) {
        throw new Error(`File processing failed: ${error.message}`);
    }
};

module.exports = {
    generateQRCodeId,
    processUploadedFile
};
