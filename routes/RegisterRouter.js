const express = require('express');
var RegisterRouter = express.Router();
const Register= require('../controller/RegiterContoller')

RegisterRouter.post("/register",(req,res,next)=>{
    Register.registerVehicle(req,res,next)
})
 
module.exports =RegisterRouter