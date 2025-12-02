const mongoose = require('mongoose');

const RegisteredVehiclesSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        rentalId: { type: mongoose.Schema.Types.ObjectId, ref: "RegisterRental", required: false },
        registerId: { type: mongoose.Schema.Types.ObjectId, ref: "Register", required: false }, // Link to Register for personal details
        vehicleType: { type: String, required: true },
        vehicleMake: { type: String },
        vehicleModel: { type: String, required: true },
        vehicleYear: { type: Number},
        licensePlate: { type: String, required: true, unique: true },
        vehicleRC: {
            type: String, // Stores the URL or path to the uploaded vehicle RC
            required: false
        },
        insuranceDocument: { type: String, },
        rentalStatus: { type: String, enum: ['available', 'rented', 'maintenance'], default: 'available' },
        vehiclePhoto: {
            type: String, // Stores the URL or path to the uploaded address proof
            required: false
        },
        gearsProvided: {
            type: String, // Stores the URL or path to the uploaded address proof
            required: false
        },
        rentalPrice: {
            type: Number, // Could be a date string, or a specific duration format
            required: true
        },
        ReturnDuration: {
        type: String, // Could be a date string, or a specific duration format
        required: true
    },
        hourlyPrice: {
            type: Number,
            required: false,
            min: 0,
            default: null
        },
        isAvailable: {
            type: Boolean,
            default: true
        },
        licencePhoto: {
            type: String, // Stores the URL or path to the uploaded photo
            required: false // Often uploaded files are handled separately or might be optional
        },
        vehicleRegistration: {
            type: String, // Stores the URL or path to the uploaded address proof
            required: false
        },
        category: {
            type: String,
            required: true,
            enum: ['2-wheeler', '4-wheeler', '2-Wheeler', '4-Wheeler']
        },
        subcategory: {
            type: String,
            required: true,
            enum: ['Bike', 'Scooty', 'Scooter', 'Car', 'Sedan', 'SUV', 'Hatchback', 'bike', 'scooty', 'scooter', 'car', 'sedan', 'suv', 'hatchback']
        },
        additionalVehicles: [{
            category: {
                type: String,
                required: true,
                enum: ['2-wheeler', '4-wheeler', '2-Wheeler', '4-Wheeler']
            },
            subcategory: {
                type: String,
                required: true,
                enum: ['Bike', 'Scooty', 'Scooter', 'Car', 'Sedan', 'SUV', 'Hatchback', 'bike', 'scooty', 'scooter', 'car', 'sedan', 'suv', 'hatchback']
            },
            model: {
                type: String,
                required: true
            },
            rentalPrice: {
                type: Number,
                required: true,
                min: 0
            },
            photo: {
                type: String,
                required: false,
                default: null
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }],
        // Document verification status
        verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending'
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null
        },
        verifiedAt: {
            type: Date,
            default: null
        },
        rejectionReason: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);
const RegisteredVehicles = mongoose.models.RegisteredVehicles || mongoose.model("RegisteredVehicles", RegisteredVehiclesSchema);
module.exports = RegisteredVehicles;