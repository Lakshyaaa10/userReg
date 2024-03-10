const { userInfo } = require("os");
const userModel= require('../Models/userModel')
    const Helper = {}
  
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

      module.exports = Helper;