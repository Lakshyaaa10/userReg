const Helper = require("../Helper/Helper");
const Register = require("../Models/RegisterModel");

const RegisterController = {};

RegisterController.registerVehicle = async (req, res) => {
  try {
    const {
      name,
      age,
      address,
      landmark,
      pincode,
      city,
      state,
      contact,
      vehicleModel,
      returnDuration,
      rentalPrice,
      agreed,
      vehicleType,
      category,
      subcategory,
      latitude,
      longitude,
    } = req.body;
    const vehiclePhoto =
      req?.files?.vehiclePhoto === undefined ? "" : req?.files?.vehiclePhoto;
    const addressPhoto =
      req?.files?.addressPhoto === undefined ? "" : req?.files?.addressPhoto;
    const vehicleRC =
      req?.files?.vehicleRC === undefined ? "" : req?.files?.vehicleRC;
    const PUC = req?.files?.PUC === undefined ? "" : req?.files?.PUC;

    if (
      !name ||
      !age ||
      !address ||
      !landmark ||
      !pincode ||
      !city ||
      !state ||
      !contact ||
      !vehicleModel ||
      !returnDuration ||
      !rentalPrice ||
      !agreed ||
      !vehicleType ||
      !category ||
      !latitude ||
      !longitude
    ) {
      Helper.response("Failed", "Please Provide all details", {}, res, 200);
      return;
    }
    if (
      vehiclePhoto == undefined ||
      vehiclePhoto == null ||
      vehiclePhoto == ""
    ) {
      Helper.response("Failed", "Please Provide Vehicle Photo", {}, res, 200);
      return;
    }
    if (
      addressPhoto == undefined ||
      addressPhoto == null ||
      addressPhoto == ""
    ) {
      Helper.response("Failed", "Please Provide Vehicle Photo", {}, res, 200);
      return;
    }
    if (vehicleRC == undefined || vehicleRC == null || vehicleRC == "") {
      Helper.response("Failed", "Please Provide Vehicle Photo", {}, res, 200);
      return;
    }
    if (PUC == undefined || PUC == null || PUC == "") {
      Helper.response("Failed", "Please Provide Vehicle Photo", {}, res, 200);
      return;
    }
    var attachment1 = "";
    var attachment2 = "";
    var attachment3 = "";
    var attachment4 = "";
    if (vehiclePhoto) {
      const upload =await Helper.uploadVehicle(vehiclePhoto);
      var attachment1 = upload;
    }
    if (addressPhoto) {
      const upload = await Helper.uploadVehicle(addressPhoto);
      var attachment2 = upload;
    }
    if (vehicleRC) {
      const upload =await Helper.uploadVehicle(vehicleRC);
      var attachment3 = upload;
    }
    if (PUC) {
      const upload = await Helper.uploadVehicle(PUC);
      var attachment4 = upload;
    }
    const newRegister = new Register({
      Name: name,
      Age: age,
      Address: address,
      Landmark: landmark,
      Pincode: pincode,
      City: city,
      State: state,
      ContactNo: contact,
      VehiclePhoto: attachment1,
      AddressProof: attachment2,
      VehicleRC: attachment3,
      PollutionCertificate: attachment4,
      VehicleModel: vehicleModel,
      ReturnDuration: returnDuration,
      rentalPrice: parseFloat(rentalPrice),
      AgreedToTerms: agreed==1?true:false,
      vehicleType: vehicleType,
      category: category || 'Bike',
      subcategory: subcategory || 'Standard',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });
    if (newRegister) {
      await newRegister.save();
      Helper.response("Success", "Registered Successfully",{},res,200);
      return;
    } else {
      Helper.response("Failed", "Unable to Register", {}, res, 200);
      return;
    }

  } catch (error) {
    console.log(error)
     Helper.response("Falied", "Internal Server Error", error, res, 200);
  }
};
RegisterController.registerRental = async (req, res) => {
  try {
    const {
      businessName,
      ownerName,
      address,
      landmark,
      pincode,
      city,
      state,
      contact,
      vehicleModel,
      rentalPrice,
      gearsProvided,
      agreed,
      vehicleType,
      category,
      subcategory,
      latitude,
      longitude,
    } = req.body;
    const vehiclePhoto =
      req?.files?.vehiclePhoto === undefined ? "" : req?.files?.vehiclePhoto;
    const vehicleRegistration =
      req?.files?.addressPhoto === undefined ? "" : req?.files?.addressPhoto;
    const licencePhoto =
      req?.files?.vehicleRC === undefined ? "" : req?.files?.vehicleRC;
    

    if (
      !businessName ||
      !ownerName ||
      !address ||
      !landmark ||
      !pincode ||
      !city ||
      !state ||
      !contact ||
      !vehicleModel ||
      !rentalPrice ||
      !agreed ||
      !gearsProvided||
      !vehicleType ||
      !latitude ||
      !longitude
    ) {
      Helper.response("Failed", "Please Provide all details", {}, res, 200);
      return;
    }
    if (
      vehiclePhoto == undefined ||
      vehiclePhoto == null ||
      vehiclePhoto == ""
    ) {
      Helper.response("Failed", "Please Provide Vehicle Photo", {}, res, 200);
      return;
    }
    if (
      vehicleRegistration == undefined ||
      vehicleRegistration == null ||
      vehicleRegistration == ""
    ) {
      Helper.response("Failed", "Please Provide vehicleRegistration", {}, res, 200);
      return;
    }
    if (licencePhoto == undefined || licencePhoto == null || licencePhoto == "") {
      Helper.response("Failed", "Please Provide Licence Photo", {}, res, 200);
      return;
    }
    var attachment1 = "";
    var attachment2 = "";
    var attachment3 = "";
    if (vehiclePhoto) {
      const upload =await Helper.uploadVehicle(vehiclePhoto);
      var attachment1 = upload;
    }
    if (vehicleRegistration) {
      const upload = await Helper.uploadVehicle(addressPhoto);
      var attachment2 = upload;
    }
    if (licencePhoto) {
      const upload =await Helper.uploadVehicle(vehicleRC);
      var attachment3 = upload;
    }
    const newRegister = new Register({
      businessName: businessName,
      ownerName: ownerName,
      Address: address,
      Landmark: landmark,
      Pincode: pincode,
      City: city,
      State: state,
      ContactNo: contact,
      VehiclePhoto: attachment1,
      vehicleRegistration: attachment2,
      licencePhoto: attachment3,
      VehicleModel: vehicleModel,
      rentalPrice: rentalPrice,
      gearsProvided:gearsProvided,
      AgreedToTerms: agreed==1?true:false,
      vehicleType: vehicleType,
      category: category || 'Bike',
      subcategory: subcategory || 'Standard',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });
    if (newRegister) {
      await newRegister.save();
      Helper.response("Success", "Rental Registered Successfully",{},res,200);
      return;
    } else {
      Helper.response("Failed", "Unable to Register", {}, res, 200);
      return;
    }

  } catch (error) {
    console.log(error)
     Helper.response("Falied", "Internal Server Error", error, res, 200);
  }
};

 
module.exports= RegisterController;