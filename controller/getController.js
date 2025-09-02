const Helper = require('../Helper/Helper');
const vehicleDetails = require('../Models/RegisterRentalModel');

const getController= {};

getController.getVehicle= async(req,res)=>{
    try {
        const data = await vehicleDetails.find()
        Helper.response("Success","data found",data,res,200)
    } catch (error) {
         Helper.response("Failed","No data found",error,res,200)
    }
}



module.exports= getController;