const { kMaxLength } = require('buffer')
const { type } = require('express/lib/response')
const mongoose = require("mongoose");

const Users = new mongoose.Schema({
    mobile:{
        type:Number,
        required:true,
        unique:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    token:{
        type:String,
        default:''
        
    },
    password:{
        type:String,
        required:true
    },
    email:{
        type:String,
        default:""
    },
    username:{
        type:String,
        required:true,
        unique:true
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
        enum: ['renter', 'owner', 'both'],
        default: 'renter'
    }
})
const userModel= mongoose.models.users || mongoose.model("users",Users)
module.exports = userModel
