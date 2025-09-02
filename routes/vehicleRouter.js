const express= require('express');
var vehicleRoutes= express.Router();
const getController= require('../controller/getController')

vehicleRoutes.get("/getVehicle",(req,res,next)=>{
    getController.getVehicle(req,res,next);
})

module.exports= vehicleRoutes;