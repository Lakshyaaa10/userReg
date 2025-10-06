const mongoose = require('mongoose');

const RegisterSchema = new mongoose.Schema({
    Name: {
        type: String,
        required: true,
    },
    Age: {
        type: Number,
        required: true
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
        required: true,// Assuming contact numbers should be unique for each registration
    },
    VehiclePhoto: {
        type: String, // Stores the URL or path to the uploaded photo
        required: false // Often uploaded files are handled separately or might be optional
    },
    AddressProof: {
        type: String, // Stores the URL or path to the uploaded address proof
        required: false
    },
    VehicleRC: {
        type: String, // Stores the URL or path to the uploaded vehicle RC
        required: false
    },
    PollutionCertificate: {
        type: String, // Stores the URL or path to the uploaded pollution certificate
        required: false
    },
    VehicleModel: {
        type: String,
        required: true
    },
    ReturnDuration: {
        type: String, // Could be a date string, or a specific duration format
        required: true
    },
    rentalPrice: {
        type: Number,
        required: true,
        min: 0 // Ensure price is not negative
    },
    hourlyPrice: {
        type: Number,
        required: false,
        min: 0,
        default: null
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
        required: true,
        enum: ['bike', 'scooty', 'car', 'scooter', 'sedan', 'SUV', 'suv', 'hatchback', 'Bike', 'Scooty', 'Car', 'Scooter', 'Sedan', 'Hatchback'],
        default:"bike"
    },
    category: {
        type: String,
        required: true,
        enum: ['2-wheeler', '4-wheeler', '2-Wheeler', '4-Wheeler'],
        default: '2-wheeler'
    },
    subcategory: {
        type: String,
        required: true,
        enum: ['Bike', 'Scooty', 'Sedan', 'SUV', 'Hatchback', 'bike', 'scooty', 'sedan', 'suv', 'hatchback'],
        default: 'Bike'
    },
    // RTO Assistance fields
    rtoAssistanceRequested: {
        type: Boolean,
        default: false
    },
    rtoAssistanceStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'rejected'],
        default: 'pending'
    },
    rtoAssistanceNotes: {
        type: String,
        default: ''
    },
    rtoAssistanceUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },
    rtoAssistanceUpdatedAt: {
        type: Date,
        default: null
    },
    // User reference for notifications
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
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
RegisterSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Register = mongoose.model('Register', RegisterSchema);

module.exports = Register;