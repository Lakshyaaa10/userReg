const mongoose = require('mongoose');

const registerRentalSchema = new mongoose.Schema({
    businessName: {
        type: String,
        required: true,
        unique: true // Assuming each lister name should be unique
    },
    ownerName: {
        type: String,
        required: true,
        unique: true // Assuming each lister name should be unique
    },
   
    Address: {
        type: String,
        required: true
    },
    Landmark: {
        type: String,
        required: false ,
        default:""// Landmark is typically optional
    },
    Pincode: {
        type: String, // Pincodes can start with 0, so String is safer
        required: true
    },
    City: {
        type: String,
        required: true
    },
    State: {
        type: String,
        required: true
    },
    ContactNo: {
        type: String, // Storing as string to handle various formats (e.g., with country codes, spaces)
        required: true,
        unique: true // Assuming contact numbers should be unique for each registration
    },
    licencePhoto: {
        type: String, // Stores the URL or path to the uploaded photo
        required: false // Often uploaded files are handled separately or might be optional
    },
    vehicleRegistration: {
        type: String, // Stores the URL or path to the uploaded address proof
        required: false
    },
    VehicleModel: {
        type: String,
        required: true
    },
    rentalPrice: {
        type: Number, // Could be a date string, or a specific duration format
        required: true
    },
    vehiclePhoto: {
        type: String, // Stores the URL or path to the uploaded address proof
        required: false
    },
    gearsProvided: {
        type: String, // Stores the URL or path to the uploaded address proof
        required: false
    },
    // Optional: Add a field for the "I have read and agree to the terms and conditions." checkbox
    AgreedToTerms: {
        type: Boolean,
        required: true,
        default: false
    },
    // Optional: Timestamps for when the entry was created/updated
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    vehicleType:{
        type:String,
        default:""
    },
    // Location coordinates
    latitude: {
        type: Number,
        required: false,
        default: null
    },
    longitude: {
        type: Number,
        required: false,
        default: null
    }
});

// Add a pre-save hook to update the updatedAt field
registerRentalSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const registerRental = mongoose.model('registerRentalSchema', registerRentalSchema);

module.exports = registerRental;