const Helper = require("../Helper/Helper");
const Register = require("../Models/RegisterModel");
const registerRental = require("../Models/registerRentalModel");

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
      hourlyPrice,
      agreed,
      vehicleType,
      category,
      subcategory,
      latitude,
      longitude,
      userId,
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
    // Auto-determine category and subcategory based on vehicleType
    let autoCategory = '2-wheeler';
    let autoSubcategory = 'Bike';
    
    const vehicleTypeLower = vehicleType.toLowerCase();
    if (vehicleTypeLower === 'bike') {
      autoCategory = '2-wheeler';
      autoSubcategory = 'Bike';
    } else if (vehicleTypeLower === 'scooty' || vehicleTypeLower === 'scooter') {
      autoCategory = '2-wheeler';
      autoSubcategory = 'Scooty';
    } else if (vehicleTypeLower === 'sedan') {
      autoCategory = '4-wheeler';
      autoSubcategory = 'Sedan';
    } else if (vehicleTypeLower === 'suv') {
      autoCategory = '4-wheeler';
      autoSubcategory = 'SUV';
    } else if (vehicleTypeLower === 'hatchback') {
      autoCategory = '4-wheeler';
      autoSubcategory = 'Hatchback';
    } else if (vehicleTypeLower === 'car') {
      autoCategory = '4-wheeler';
      autoSubcategory = subcategory || 'Sedan';
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
      hourlyPrice: hourlyPrice ? parseFloat(hourlyPrice) : null,
      AgreedToTerms: agreed==1?true:false,
      vehicleType: vehicleType,
      category: category || autoCategory,
      subcategory: subcategory || autoSubcategory,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      userId: userId,
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
    // Accept both camelCase and capitalized keys from clients
    const body = req.body || {};
    const businessName = body.businessName || body.BusinessName;
    const ownerName = body.ownerName || body.OwnerName;
    const nameForRegister = body.name || body.Name || ownerName || '';
    const ageForRegister = body.age || body.Age;
    const returnDurationForRegister = body.returnDuration || body.ReturnDuration || '5 days';
    const address = body.address || body.Address;
    const landmark = body.landmark || body.Landmark || "";
    const pincode = body.pincode || body.Pincode;
    const city = body.city || body.City;
    const state = body.state || body.State;
    const contact = body.contact || body.ContactNo || body.Contact || body.contactNo;
    const vehicleModel = body.vehicleModel || body.VehicleModel;
    const rentalPrice = body.rentalPrice;
    const hourlyPrice = body.hourlyPrice;
    const gearsProvided = body.gearsProvided || body.GearsProvided || "";
    const agreed = (body.agreed !== undefined ? body.agreed : body.AgreedToTerms);
    const vehicleType = body.vehicleType || body.VehicleType;
    const category = body.category || body.Category;
    const subcategory = body.subcategory || body.Subcategory;
    const latitude = body.latitude || body.Latitude;
    const longitude = body.longitude || body.Longitude;
    const additionalVehicles = body.additionalVehicles;

    // Correct file fields expected from client
    const vehiclePhoto = req?.files?.vehiclePhoto === undefined ? "" : req?.files?.vehiclePhoto;
    const vehicleRegistration = req?.files?.vehicleRegistration === undefined ? "" : req?.files?.vehicleRegistration;
    const licencePhoto = req?.files?.licencePhoto === undefined ? "" : req?.files?.licencePhoto;
    

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
      // gearsProvided is optional per model, do not require
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

    // Parse and validate additional vehicles
    let parsedAdditionalVehicles = [];
    if (additionalVehicles) {
      try {
        parsedAdditionalVehicles = JSON.parse(additionalVehicles);
        
        // Validate each additional vehicle
        for (let i = 0; i < parsedAdditionalVehicles.length; i++) {
          const vehicle = parsedAdditionalVehicles[i];
          if (!vehicle.category || !vehicle.subcategory || !vehicle.model || !vehicle.rentalPrice) {
            Helper.response("Failed", `Please provide all details for additional vehicle ${i + 1}`, {}, res, 200);
            return;
          }
          
          // Validate category and subcategory
          const validCategories = ['2-wheeler', '4-wheeler', '2-Wheeler', '4-Wheeler'];
          const validSubcategories = ['Bike', 'Scooty', 'Scooter', 'Car', 'Sedan', 'SUV', 'Hatchback', 'bike', 'scooty', 'scooter', 'car', 'sedan', 'suv', 'hatchback'];
          
          if (!validCategories.includes(vehicle.category)) {
            Helper.response("Failed", `Invalid category for additional vehicle ${i + 1}`, {}, res, 200);
            return;
          }
          
          if (!validSubcategories.includes(vehicle.subcategory)) {
            Helper.response("Failed", `Invalid subcategory for additional vehicle ${i + 1}`, {}, res, 200);
            return;
          }
          
          // Ensure rental price is a number
          if (isNaN(parseFloat(vehicle.rentalPrice)) || parseFloat(vehicle.rentalPrice) < 0) {
            Helper.response("Failed", `Invalid rental price for additional vehicle ${i + 1}`, {}, res, 200);
            return;
          }
        }
      } catch (error) {
        Helper.response("Failed", "Invalid additional vehicles data format", {}, res, 200);
        return;
      }
    }
    var attachment1 = "";
    var attachment2 = "";
    var attachment3 = "";
    if (vehiclePhoto) {
      const upload =await Helper.uploadVehicle(vehiclePhoto);
      var attachment1 = upload;
    }
    if (vehicleRegistration) {
      const upload = await Helper.uploadVehicle(vehicleRegistration);
      var attachment2 = upload;
    }
    if (licencePhoto) {
      const upload =await Helper.uploadVehicle(licencePhoto);
      var attachment3 = upload;
    }
    const newRegister = new registerRental({
      // Fields required by shared Register model
      Name: nameForRegister,
      Age: ageForRegister ? parseInt(ageForRegister) : 0,
      ReturnDuration: returnDurationForRegister,
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
      hourlyPrice: hourlyPrice ? parseFloat(hourlyPrice) : null,
      gearsProvided: gearsProvided || "",
      AgreedToTerms: (agreed===true || agreed===1 || agreed==='1') ? true : false,
      vehicleType: vehicleType,
      category: category || (vehicleType?.toLowerCase().includes('car') || vehicleType?.toLowerCase().includes('sedan') || vehicleType?.toLowerCase().includes('suv') || vehicleType?.toLowerCase().includes('hatchback') ? '4-wheeler' : '2-wheeler'),
      subcategory: subcategory || (vehicleType?.toLowerCase() === 'bike' ? 'Bike' : vehicleType?.toLowerCase() === 'scooty' ? 'Scooty' : vehicleType),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      additionalVehicles: parsedAdditionalVehicles.map(vehicle => ({
        category: vehicle.category,
        subcategory: vehicle.subcategory,
        model: vehicle.model,
        rentalPrice: parseFloat(vehicle.rentalPrice),
        photo: vehicle.photo || null,
        addedAt: new Date()
      }))
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