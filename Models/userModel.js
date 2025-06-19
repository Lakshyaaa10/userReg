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
    }
})
const userModel= mongoose.model("users",Users)
module.exports = userModel
