const { userInfo } = require("os");
const userModel= require('../Models/userModel')
const Helper = {}
const cloudinary =require('cloudinary');
const { error } = require("console");
  
cloudinary.v2.config({
  cloud_name:"dmj7uubkb",
  api_key:"773738537246321",
  api_secret:"fQX6rWHbCcG1xCW1Sqq4UdM2F4M",
  secure:true
})
    Helper.response = (status, message, data = [], res, statusCode) => {
        res.status(statusCode).json({
          status: status,
          message: message,
          data: data,
        });
      };

    Helper.updateToken=async(id,token)=>{
        
        
        const  userData=await userModel.findByIdAndUpdate(id,{token:token})
        if(userData){
            return token
        }
        
    }  
    Helper.uploadVehicle=async(image)=>{
      try{
         if (!image || !image.tempFilePath) {
      Helper.response("Failed","No temp file found",{},res,200)
    }
         const upload = await cloudinary.uploader.upload(image.tempFilePath,{
        folder:"Register",
         use_filename: true,
         unique_filename: false,
         overwrite: true,
         resource_type: "image",
      })
      return upload.secure_url;
      }catch(err){
        console.log(err)
      } 
     
    }
      module.exports = Helper;