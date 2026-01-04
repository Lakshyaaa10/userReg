const mongoose = require('mongoose');
const Helper = require("../Helper/Helper");
const Register = require("../Models/RegisterModel");
const registerRental = require("../Models/RegisterRentalModel");
const RegisteredVehicles = require("../Models/RegisteredVehicles");
const RegisterController = {};
const Users = require("../Models/userModel");

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
    console.log(vehiclePhoto);
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

    if (vehicleRC == undefined || vehicleRC == null || vehicleRC == "") {
      Helper.response("Failed", "Please Provide Vehicle RC Photo", {}, res, 200);
      return;
    }

    var attachment1 = "";
    var attachment2 = "";
    var attachment3 = "";
    var attachment4 = "";
    if (vehiclePhoto) {
      const upload = await Helper.uploadVehicle(vehiclePhoto);
      var attachment1 = upload;
    }
    if (addressPhoto) {
      const upload = await Helper.uploadVehicle(addressPhoto);
      var attachment2 = upload;
    }
    if (vehicleRC) {
      const upload = await Helper.uploadVehicle(vehicleRC);
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

    // Create Register entry for personal details
    const newRegister = new Register({
      Name: name,
      Age: age,
      Address: address,
      Landmark: landmark,
      Pincode: pincode,
      City: city,
      State: state,
      ContactNo: contact,
      AddressProof: attachment2,
      PollutionCertificate: attachment4,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      userId: userId,
      AgreedToTerms: agreed == 1 ? true : false,
    });

    await newRegister.save();

    // Create RegisteredVehicles entry for vehicle details
    const userIdObjectId = userId ?
      (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId)
      : userId;

    // Generate a unique license plate if not provided (using timestamp + random)
    const licensePlate = `REG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const newVehicle = new RegisteredVehicles({
      userId: userIdObjectId,
      registerId: newRegister._id, // Link to Register entry for personal details
      vehicleType: vehicleType,
      vehicleModel: vehicleModel,
      licensePlate: licensePlate,
      registrationDocument: attachment2, // Address proof
      vehicleRC: attachment3,
      vehiclePhoto: attachment1,
      rentalPrice: parseFloat(rentalPrice),
      hourlyPrice: hourlyPrice ? parseFloat(hourlyPrice) : null,
      category: category || autoCategory,
      subcategory: subcategory || autoSubcategory,
      verificationStatus: 'pending', // Set to pending for admin verification
      isAvailable: true,
      rentalPrice: parseFloat(rentalPrice),
      ReturnDuration: returnDuration
    });

    await newVehicle.save();

    // Link vehicle to register entry by storing registerId in vehicle (we'll add this field if needed)
    // For now, we can use userId to link them

    Helper.response("Success", "Vehicle registered successfully. Your documents are pending admin verification.", {
      registerId: newRegister._id,
      vehicleId: newVehicle._id
    }, res, 200);
    return;

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
    const address = body.address || body.Address;
    const landmark = body.landmark || body.Landmark || "";
    const pincode = body.pincode || body.Pincode;
    const city = body.city || body.City;
    const state = body.state || body.State;
    const contact = body.contact || body.ContactNo || body.Contact || body.contactNo;
    const agreed = (body.agreed !== undefined ? body.agreed : body.AgreedToTerms);
    const latitude = body.latitude || body.Latitude;
    const longitude = body.longitude || body.Longitude;

    // Vehicle fields for RegisteredVehicles model
    // const userId = body.userId || body.UserId;
    const vehicleType = body.vehicleType || body.VehicleType;
    const vehicleMake = body.vehicleMake || body.VehicleMake;
    const vehicleModel = body.vehicleModel || body.VehicleModel;
    const vehicleYear = body.vehicleYear || body.VehicleYear;
    const licensePlate = body.licensePlate || body.LicensePlate;
    const rentalPrice = body.rentalPrice;
    const hourlyPrice = body.hourlyPrice;
    const returnDuration = body.returnDuration || body.ReturnDuration || '1 day';
    const gearsProvided = body.gearsProvided || body.GearsProvided || "";
    const category = body.category || body.Category;
    const subcategory = body.subcategory || body.Subcategory;
    const additionalVehicles = body.additionalVehicles;
    const insuranceDocument = body.insuranceDocument || body.InsuranceDocument;

    // Correct file fields expected from client
    const vehiclePhoto = req?.files?.vehiclePhoto === undefined ? "" : req?.files?.vehiclePhoto;
    const vehicleRegistration = req?.files?.vehicleRegistration === undefined ? "" : req?.files?.vehicleRegistration;
    const licencePhoto = req?.files?.licencePhoto === undefined ? "" : req?.files?.licencePhoto;
    const vehicleRC = req?.files?.vehicleRC === undefined ? "" : req?.files?.vehicleRC;
    const rentalImage = req?.files?.rentalImage === undefined ? "" : req?.files?.rentalImage;


    // Validation for RegisterRental model fields
    if (
      !businessName ||
      !ownerName ||
      !address ||
      !pincode ||
      !city ||
      !state ||
      !contact ||
      !agreed
    ) {
      Helper.response("Failed", "Please Provide all rental business details (businessName, ownerName, address, pincode, city, state, contact, agreed)", {}, res, 200);
      return;
    }
    const userId = (await Users.findOne({
      token: req?.headers?.authorization?.split(" ")[1]
    }).select('_id'))?._id.toString();


    // Validation for RegisteredVehicles model required fields
    if (
      !userId ||
      !vehicleType ||

      !vehicleModel ||

      !licensePlate ||
      !rentalPrice ||
      !category ||
      !subcategory
    ) {
      console.log("Missing vehicle details:", {
        userId,
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        licensePlate,
        rentalPrice,
        category,
        subcategory
      });
      Helper.response("Failed", "Please Provide all vehicle details (userId, vehicleType, vehicleMake, vehicleModel, vehicleYear, licensePlate, rentalPrice, category, subcategory)", {}, res, 200);
      return;
    }

    // Validate category and subcategory
    const validCategories = ['2-wheeler', '4-wheeler', '2-Wheeler', '4-Wheeler'];
    const validSubcategories = ['Bike', 'Scooty', 'Scooter', 'Car', 'Sedan', 'SUV', 'Hatchback', 'bike', 'scooty', 'scooter', 'car', 'sedan', 'suv', 'hatchback'];

    if (!validCategories.includes(category)) {
      Helper.response("Failed", "Invalid category. Must be one of: 2-wheeler, 4-wheeler, 2-Wheeler, 4-Wheeler", {}, res, 200);
      return;
    }

    if (!validSubcategories.includes(subcategory)) {
      Helper.response("Failed", "Invalid subcategory", {}, res, 200);
      return;
    }

    // File validations - vehicleRegistration is required for RegisteredVehicles model
    if (
      vehicleRegistration == undefined ||
      vehicleRegistration == null ||
      vehicleRegistration == ""
    ) {
      Helper.response("Failed", "Please Provide vehicleRegistration document", {}, res, 200);
      return;
    }

    // Parse and validate additional vehicles
    let parsedAdditionalVehicles = [];
    if (additionalVehicles) {
      try {
        parsedAdditionalVehicles = typeof additionalVehicles === 'string'
          ? JSON.parse(additionalVehicles)
          : additionalVehicles;

        // Validate each additional vehicle
        for (let i = 0; i < parsedAdditionalVehicles.length; i++) {
          const vehicle = parsedAdditionalVehicles[i];
          if (!vehicle.category || !vehicle.subcategory || !vehicle.model || !vehicle.rentalPrice) {
            Helper.response("Failed", `Please provide all details for additional vehicle ${i + 1}`, {}, res, 200);
            return;
          }

          // Validate category and subcategory
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

    // Upload files
    var attachment1 = "";
    var attachment2 = "";
    var attachment3 = "";
    var attachment4 = "";

    if (vehiclePhoto) {
      const upload = await Helper.uploadVehicle(vehiclePhoto);
      attachment1 = upload;
    }
    if (vehicleRegistration) {
      const upload = await Helper.uploadVehicle(vehicleRegistration);
      attachment2 = upload;
    }
    if (licencePhoto) {
      const upload = await Helper.uploadVehicle(licencePhoto);
      attachment3 = upload;
    }
    if (vehicleRC) {
      const upload = await Helper.uploadVehicle(vehicleRC);
      attachment4 = upload;
    }

    // Upload rental image
    let rentalImageUrl = "";
    if (rentalImage) {
      const upload = await Helper.uploadVehicle(rentalImage);
      rentalImageUrl = upload;
    }

    // Create RegisterRental entry
    const newRegister = new registerRental({
      businessName: businessName,
      ownerName: ownerName,
      Address: address,
      Landmark: landmark || "",
      Pincode: pincode,
      City: city,
      State: state,
      ContactNo: contact,
      rentalImage: rentalImageUrl,
      AgreedToTerms: (agreed === true || agreed === 1 || agreed === '1') ? true : false,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    });

    await newRegister.save();

    // Create RegisteredVehicles entry for the main vehicle
    // Convert userId to ObjectId if it's a valid string
    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Main vehicle entry
    const vehicleEntry = new RegisteredVehicles({
      rentalId: newRegister._id,
      userId: userIdObjectId,
      vehicleType: vehicleType,
      vehicleMake: vehicleMake,
      vehicleModel: vehicleModel,
      vehicleYear: parseInt(vehicleYear),
      licensePlate: licensePlate,
      registrationDocument: attachment2, // vehicleRegistration file
      vehicleRC: attachment4 || null,
      insuranceDocument: insuranceDocument || null,
      vehiclePhoto: attachment1 || null,
      licencePhoto: attachment3 || null,
      vehicleRegistration: attachment2 || null,
      gearsProvided: gearsProvided || "",
      rentalPrice: parseFloat(rentalPrice),
      hourlyPrice: hourlyPrice ? parseFloat(hourlyPrice) : null,
      ReturnDuration: returnDuration,
      category: category,
      subcategory: subcategory,
      verificationStatus: 'pending' // Set to pending for admin verification
    });

    await vehicleEntry.save();

    // Create separate RegisteredVehicles documents for each additional vehicle
    // All linked by the same rentalId
    if (parsedAdditionalVehicles && parsedAdditionalVehicles.length > 0) {
      for (const additionalVehicle of parsedAdditionalVehicles) {
        // Generate unique license plate for each additional vehicle
        const additionalLicensePlate = `RENTAL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const additionalVehicleEntry = new RegisteredVehicles({
          rentalId: newRegister._id, // Same rentalId to link all vehicles
          userId: userIdObjectId,
          vehicleType: additionalVehicle.subcategory, // Use subcategory as vehicle type
          vehicleMake: additionalVehicle.make || vehicleMake, // Use same make if not provided
          vehicleModel: additionalVehicle.model,
          vehicleYear: additionalVehicle.year ? parseInt(additionalVehicle.year) : null,
          licensePlate: additionalLicensePlate,
          registrationDocument: attachment2, // Share same business documents
          vehicleRC: null,
          insuranceDocument: null,
          vehiclePhoto: null, // Photo handling for additional vehicles can be added later
          licencePhoto: attachment3,
          vehicleRegistration: attachment2,
          gearsProvided: gearsProvided || "",
          rentalPrice: parseFloat(additionalVehicle.rentalPrice),
          hourlyPrice: null,
          ReturnDuration: returnDuration,
          category: additionalVehicle.category,
          subcategory: additionalVehicle.subcategory,
          verificationStatus: 'pending'
        });

        await additionalVehicleEntry.save();
      }
    }

    Helper.response("Success", "Rental registered successfully. Your documents are pending admin verification.", {
      rentalId: newRegister._id,
      mainVehicleId: vehicleEntry._id,
      totalVehiclesRegistered: 1 + (parsedAdditionalVehicles?.length || 0)
    }, res, 200);
    return;

  } catch (error) {
    console.log(error);
    Helper.response("Failed", "Internal Server Error", error, res, 200);
  }
};


module.exports = RegisterController;