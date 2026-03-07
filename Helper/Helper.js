const userModel = require('../Models/userModel');
const path = require('path');
const fs = require('fs');

const Helper = {};

Helper.response = (status, message, data = [], res, statusCode) => {
    res.status(statusCode).json({
        status: status,
        message: message,
        data: data,
    });
};

Helper.updateToken = async (id, token) => {
    const userData = await userModel.findByIdAndUpdate(id, { token: token });
    if (userData) {
        return token;
    }
};

/**
 * Saves an uploaded file (from express-fileupload) to the local uploads directory
 * and returns a publicly accessible URL.
 *
 * @param {object} image - The file object from req.files (has .tempFilePath and .name)
 * @param {string} [subfolder='vehicles'] - Subfolder inside /uploads to organise files
 * @returns {string} The public URL for the saved file
 */
Helper.uploadVehicle = async (image, subfolder = 'vehicles') => {
    try {
        if (!image || !image.tempFilePath) {
            throw new Error("No temp file found");
        }

        // Ensure the uploads/<subfolder> directory exists
        const uploadDir = path.join(__dirname, '..', 'uploads', subfolder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Build a unique filename: timestamp-originalname
        const ext = path.extname(image.name) || '.jpg';
        const baseName = path.basename(image.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uniqueName = `${Date.now()}-${baseName}${ext}`;
        const destPath = path.join(uploadDir, uniqueName);

        // Copy the temp file to the destination
        fs.copyFileSync(image.tempFilePath, destPath);

        // Return the publicly accessible URL
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
        return `${baseUrl}/uploads/${subfolder}/${uniqueName}`;

    } catch (err) {
        console.error('File upload error:', err);
        throw err;
    }
};

module.exports = Helper;