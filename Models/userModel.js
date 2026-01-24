const { kMaxLength } = require('buffer')
const { type } = require('express/lib/response')
const mongoose = require("mongoose");

const Users = new mongoose.Schema({
    mobile: {
        type: Number,
        default: null,
        unique: true,
        sparse: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    token: {
        type: String,
        default: ''

    },
    password: {
        type: String,
        default: ""
    },
    googleId: {
        type: String,
        default: "",
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        default: ""
    },
    username: {
        type: String,
        default: "",
        unique: true,
        sparse: true
    },
    // User profile fields
    fullName: {
        type: String,
        default: ""
    },
    dateOfBirth: {
        type: Date,
        default: null
    },
    address: {
        type: String,
        default: ""
    },
    city: {
        type: String,
        default: ""
    },
    state: {
        type: String,
        default: ""
    },
    pincode: {
        type: String,
        default: ""
    },
    // Driver's license verification
    isLicenseVerified: {
        type: Boolean,
        default: false
    },
    // Push notification token
    pushToken: {
        type: String,
        default: ""
    },
    // User type
    userType: {
        type: String,
        enum: ['renter', 'owner', 'both', 'rental_owner'],
        default: 'renter'
    },
    // Payout Information (For Owners)
    payoutMethod: {
        type: {
            type: String,
            enum: ['bank_account', 'vpa'], // vpa = UPI ID
            default: 'bank_account'
        },
        accountNumber: { type: String },
        ifsc: { type: String }, // For bank_account
        vpa: { type: String },   // For UPI
        beneficiaryName: { type: String }
    },
    razorpayFundAccountId: {
        type: String, // ID from RazorpayX Fund Account
        default: ""
    },
    razorpayContactId: {
        type: String, // ID from RazorpayX Contact
        default: ""
    },
    // Referral System
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    walletPoints: {
        type: Number,
        default: 0
    },
    referralHistory: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        pointsEarned: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    }]
})
const userModel = mongoose.models.users || mongoose.model("users", Users)
module.exports = userModel
