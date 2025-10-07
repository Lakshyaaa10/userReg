const Helper = require('../Helper/Helper');
const Register = require('../Models/RegisterModel');
const Availability = require('../Models/AvailabilityModel');
const Booking = require('../Models/BookingModel');

const SearchController = {};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}

// Search vehicles with filters
SearchController.searchVehicles = async (req, res) => {
    try {
        const { 
            city, 
            startDate, 
            endDate, 
            vehicleType, 
            minPrice, 
            maxPrice,
            latitude,
            longitude,
            radius = 50, // Default radius in kilometers
            page = 1, 
            limit = 20 
        } = req.query;

        const skip = (page - 1) * limit;
        let query = {};

        // City filter
        if (city) {
            query.City = { $regex: city, $options: 'i' };
        }

        // Vehicle type filter with case-insensitive matching
        if (vehicleType && vehicleType !== 'all' && vehicleType !== 'All') {
            query.vehicleType = { $regex: new RegExp(`^${vehicleType}$`, 'i') };
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.rentalPrice = {};
            if (minPrice) query.rentalPrice.$gte = parseInt(minPrice);
            if (maxPrice) query.rentalPrice.$lte = parseInt(maxPrice);
        }

        // Location-based filter (geospatial query)
        if (latitude && longitude) {
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);
            const radiusInKm = parseFloat(radius);
            
            // Ensure latitude and longitude are not null in the database
            query.latitude = { $ne: null };
            query.longitude = { $ne: null };
        }

        // Get available vehicles
        let availableVehicles = [];
        
        if (startDate && endDate) {
            // Check availability for date range
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Get all vehicles matching basic criteria
            const allRentals = await Register.find(query)
                .select('Name VehicleModel vehicleType rentalPrice City State VehiclePhoto ContactNo Address additionalVehicles businessName ownerName')
                .sort({ createdAt: -1 });

            // Flatten vehicles from main field and additionalVehicles array
            let allVehicles = [];
            for (const rental of allRentals) {
                // Add main vehicle
                if (rental.VehicleModel && rental.vehicleType) {
                    allVehicles.push({
                        _id: rental._id,
                        Name: rental.Name,
                        VehicleModel: rental.VehicleModel,
                        vehicleType: rental.vehicleType,
                        rentalPrice: rental.rentalPrice,
                        City: rental.City,
                        State: rental.State,
                        VehiclePhoto: rental.VehiclePhoto,
                        ContactNo: rental.ContactNo,
                        Address: rental.Address,
                        businessName: rental.businessName,
                        ownerName: rental.ownerName,
                        isMainVehicle: true
                    });
                }

                // Add additional vehicles
                if (rental.additionalVehicles && rental.additionalVehicles.length > 0) {
                    for (const additionalVehicle of rental.additionalVehicles) {
                        allVehicles.push({
                            _id: rental._id,
                            Name: rental.Name,
                            VehicleModel: additionalVehicle.model,
                            vehicleType: additionalVehicle.subcategory,
                            rentalPrice: additionalVehicle.rentalPrice,
                            City: rental.City,
                            State: rental.State,
                            VehiclePhoto: additionalVehicle.photo || rental.VehiclePhoto,
                            ContactNo: rental.ContactNo,
                            Address: rental.Address,
                            businessName: rental.businessName,
                            ownerName: rental.ownerName,
                            isMainVehicle: false,
                            additionalVehicleId: additionalVehicle._id
                        });
                    }
                }
            }

            // Filter by availability
            for (const vehicle of allVehicles) {
                let isAvailable = true;
                
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const availability = await Availability.findOne({
                        vehicleId: vehicle._id,
                        date: d,
                        isAvailable: false
                    });
                    
                    if (availability) {
                        isAvailable = false;
                        break;
                    }
                }
                
                if (isAvailable) {
                    availableVehicles.push(vehicle);
                }
            }
        } else {
            // No date filter, but still check for current bookings
            const allVehicles = await Register.find(query)
                .select('Name VehicleModel vehicleType category subcategory rentalPrice hourlyPrice City State VehiclePhoto ContactNo Address latitude longitude')
                .sort({ createdAt: -1 });

            // Filter out vehicles that are currently booked (today onwards)
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            availableVehicles = [];
            for (const vehicle of allVehicles) {
                // Check if vehicle has any active bookings
                const activeBooking = await Booking.findOne({
                    vehicleId: vehicle._id,
                    status: { $in: ['pending', 'accepted', 'in_progress'] },
                    endDate: { $gte: today }
                });
                
                if (!activeBooking) {
                    availableVehicles.push(vehicle);
                }
            }
        }

        // Calculate distance for each vehicle if user location is provided
        if (latitude && longitude) {
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);
            const radiusInKm = parseFloat(radius);
            
            availableVehicles = availableVehicles.map(vehicle => {
                const vehicleLat = vehicle.latitude;
                const vehicleLon = vehicle.longitude;
                
                // Calculate distance using Haversine formula
                const distance = calculateDistance(userLat, userLon, vehicleLat, vehicleLon);
                
                return {
                    ...vehicle.toObject(),
                    distance: parseFloat(distance.toFixed(2)) // Distance in km
                };
            }).filter(vehicle => vehicle.distance <= radiusInKm) // Filter by radius
              .sort((a, b) => a.distance - b.distance); // Sort by distance (nearest first)
        }

        // Pagination
        const totalCount = availableVehicles.length;
        const paginatedVehicles = availableVehicles.slice(skip, skip + parseInt(limit));

        Helper.response("Success", "Vehicles retrieved successfully", {
            vehicles: paginatedVehicles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            },
            userLocation: latitude && longitude ? {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                radius: parseFloat(radius)
            } : null
        }, res, 200);

    } catch (error) {
        console.error('Search vehicles error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicle details by ID
SearchController.getVehicleDetails = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        if (!vehicleId) {
            return Helper.response("Failed", "Missing vehicleId", {}, res, 400);
        }

        const vehicle = await Register.findById(vehicleId)
            .select('Name VehicleModel vehicleType rentalPrice City State VehiclePhoto ContactNo Address Landmark Pincode gearsProvided');

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Get availability for next 30 days
        const availability = await Availability.find({
            vehicleId: vehicleId,
            date: { $gte: new Date() },
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }).select('date isAvailable reason');

        Helper.response("Success", "Vehicle details retrieved successfully", {
            vehicle,
            availability
        }, res, 200);

    } catch (error) {
        console.error('Get vehicle details error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get popular cities
SearchController.getPopularCities = async (req, res) => {
    try {
        const cities = await Register.aggregate([
            {
                $group: {
                    _id: '$City',
                    vehicleCount: { $sum: 1 }
                }
            },
            {
                $sort: { vehicleCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $project: {
                    city: '$_id',
                    vehicleCount: 1,
                    _id: 0
                }
            }
        ]);

        Helper.response("Success", "Popular cities retrieved successfully", { cities }, res, 200);

    } catch (error) {
        console.error('Get popular cities error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicle types
SearchController.getVehicleTypes = async (req, res) => {
    try {
        const vehicleTypes = await Register.aggregate([
            {
                $group: {
                    _id: '$vehicleType',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        Helper.response("Success", "Vehicle types retrieved successfully", { vehicleTypes }, res, 200);

    } catch (error) {
        console.error('Get vehicle types error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicles by category with enhanced filtering
SearchController.getVehiclesByCategory = async (req, res) => {
    try {
        const { 
            category = 'all',
            subcategory,
            city,
            minPrice,
            maxPrice,
            latitude,
            longitude,
            radius = 50,
            page = 1,
            limit = 20
        } = req.query;

        const skip = (page - 1) * limit;
        let query = {};

        // Category filter (2-wheeler or 4-wheeler)
        if (category && category !== 'all' && category !== 'All') {
            const categoryLower = category.toLowerCase();
            
            if (categoryLower === '2-wheeler' || categoryLower === '2wheeler') {
                query.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } },
                    { vehicleType: { $in: ['bike', 'Bike', 'scooty', 'Scooty', 'scooter', 'Scooter'] } }
                ];
            } else if (categoryLower === '4-wheeler' || categoryLower === '4wheeler') {
                query.$or = [
                    { category: { $in: ['4-wheeler', '4-Wheeler'] } },
                    { vehicleType: { $in: ['car', 'Car', 'sedan', 'Sedan', 'SUV', 'suv', 'hatchback', 'Hatchback'] } }
                ];
            } else if (categoryLower === 'bike') {
                query.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } },
                    { vehicleType: { $in: ['bike', 'Bike', 'scooty', 'Scooty', 'scooter', 'Scooter'] } }
                ];
                query.subcategory = { $in: ['bike', 'Bike', 'BIKE'] };
            } else if (categoryLower === 'scooty') {
                query.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } },
                    { vehicleType: { $in: ['bike', 'Bike', 'scooty', 'Scooty', 'scooter', 'Scooter'] } }
                ];
                query.subcategory = { $in: ['scooty', 'Scooty', 'scooter', 'Scooter'] };
            } else if (categoryLower === 'car') {
                query.$or = [
                    { category: { $in: ['4-wheeler', '4-Wheeler'] } },
                    { vehicleType: { $in: ['car', 'Car', 'sedan', 'Sedan', 'SUV', 'suv', 'hatchback', 'Hatchback'] } }
                ];
            } else {
                // Direct match for specific vehicle types
                query.vehicleType = { $regex: new RegExp(`^${category}$`, 'i') };
            }
        }

        // Subcategory filter
        if (subcategory && subcategory !== 'all' && subcategory !== 'All') {
            query.subcategory = { $regex: new RegExp(`^${subcategory}$`, 'i') };
        }

        // City filter
        if (city) {
            query.City = { $regex: city, $options: 'i' };
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.rentalPrice = {};
            if (minPrice) query.rentalPrice.$gte = parseInt(minPrice);
            if (maxPrice) query.rentalPrice.$lte = parseInt(maxPrice);
        }

        // Location-based filter
        if (latitude && longitude) {
            query.latitude = { $ne: null };
            query.longitude = { $ne: null };
        }

        // Get vehicles from main vehicle field and additionalVehicles array
        const allRentals = await Register.find(query)
            .select('Name VehicleModel vehicleType category subcategory rentalPrice hourlyPrice City State VehiclePhoto ContactNo Address Landmark Pincode latitude longitude additionalVehicles businessName ownerName')
            .sort({ createdAt: -1 });

        console.log(`Found ${allRentals.length} rental registrations for category: ${category}`);
        console.log('Query used:', JSON.stringify(query, null, 2));

        // Flatten vehicles from main field and additionalVehicles array
        let allVehicles = [];
        for (const rental of allRentals) {
            // Add main vehicle
            if (rental.VehicleModel && rental.vehicleType) {
                allVehicles.push({
                    _id: rental._id,
                    Name: rental.Name,
                    VehicleModel: rental.VehicleModel,
                    vehicleType: rental.vehicleType,
                    category: rental.category,
                    subcategory: rental.subcategory,
                    rentalPrice: rental.rentalPrice,
                    hourlyPrice: rental.hourlyPrice,
                    City: rental.City,
                    State: rental.State,
                    VehiclePhoto: rental.VehiclePhoto,
                    ContactNo: rental.ContactNo,
                    Address: rental.Address,
                    Landmark: rental.Landmark,
                    Pincode: rental.Pincode,
                    latitude: rental.latitude,
                    longitude: rental.longitude,
                    businessName: rental.businessName,
                    ownerName: rental.ownerName,
                    isMainVehicle: true
                });
            }

            // Add additional vehicles
            if (rental.additionalVehicles && rental.additionalVehicles.length > 0) {
                for (const additionalVehicle of rental.additionalVehicles) {
                    allVehicles.push({
                        _id: rental._id,
                        Name: rental.Name,
                        VehicleModel: additionalVehicle.model,
                        vehicleType: additionalVehicle.subcategory,
                        category: additionalVehicle.category,
                        subcategory: additionalVehicle.subcategory,
                        rentalPrice: additionalVehicle.rentalPrice,
                        hourlyPrice: null,
                        City: rental.City,
                        State: rental.State,
                        VehiclePhoto: additionalVehicle.photo || rental.VehiclePhoto,
                        ContactNo: rental.ContactNo,
                        Address: rental.Address,
                        Landmark: rental.Landmark,
                        Pincode: rental.Pincode,
                        latitude: rental.latitude,
                        longitude: rental.longitude,
                        businessName: rental.businessName,
                        ownerName: rental.ownerName,
                        isMainVehicle: false,
                        additionalVehicleId: additionalVehicle._id
                    });
                }
            }
        }

        console.log(`Total vehicles found: ${allVehicles.length} (including additional vehicles)`);

        // Filter out vehicles that are currently booked (today onwards)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        let vehicles = [];
        for (const vehicle of allVehicles) {
            // Check if vehicle has any active bookings
            const activeBooking = await Booking.findOne({
                vehicleId: vehicle._id,
                status: { $in: ['pending', 'accepted', 'in_progress'] },
                endDate: { $gte: today }
            });
            
            if (!activeBooking) {
                vehicles.push(vehicle);
            }
        }

        // Calculate distance and filter by radius if location is provided
        if (latitude && longitude) {
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);
            const radiusInKm = parseFloat(radius);
            
            vehicles = vehicles.map(vehicle => {
                const vehicleLat = vehicle.latitude;
                const vehicleLon = vehicle.longitude;
                const distance = calculateDistance(userLat, userLon, vehicleLat, vehicleLon);
                
                return {
                    ...vehicle.toObject(),
                    distance: parseFloat(distance.toFixed(2))
                };
            }).filter(vehicle => vehicle.distance <= radiusInKm)
              .sort((a, b) => a.distance - b.distance);
        }

        // Pagination
        const totalCount = vehicles.length;
        const paginatedVehicles = vehicles.slice(skip, skip + parseInt(limit));

        Helper.response("Success", "Vehicles retrieved successfully", {
            vehicles: paginatedVehicles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: skip + parseInt(limit) < totalCount,
                hasPrevPage: page > 1
            },
            filters: {
                category,
                city,
                minPrice,
                maxPrice
            },
            userLocation: latitude && longitude ? {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                radius: parseFloat(radius)
            } : null
        }, res, 200);

    } catch (error) {
        console.error('Get vehicles by category error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicle categories with counts
SearchController.getVehicleCategories = async (req, res) => {
    try {
        const categories = await Register.aggregate([
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                {
                                    case: { $in: ['$vehicleType', ['bike', 'Bike', 'BIKE']] },
                                    then: 'Bike'
                                },
                                {
                                    case: { $in: ['$vehicleType', ['scooty', 'Scooty', 'SCOOTY', 'scooter', 'Scooter']] },
                                    then: 'Scooty'
                                },
                                {
                                    case: { $in: ['$vehicleType', ['car', 'Car', 'CAR', 'sedan', 'Sedan', 'SUV', 'suv', 'hatchback', 'Hatchback']] },
                                    then: 'Car'
                                }
                            ],
                            default: '$vehicleType'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $project: {
                    category: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        Helper.response("Success", "Vehicle categories retrieved successfully", { categories }, res, 200);

    } catch (error) {
        console.error('Get vehicle categories error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get owner details by vehicle ID
SearchController.getOwnerDetails = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        if (!vehicleId) {
            return Helper.response("Failed", "Missing vehicleId", {}, res, 400);
        }

        const owner = await Register.findById(vehicleId)
            .select('Name Age Address Landmark Pincode City State ContactNo VehicleModel ReturnDuration rentalPrice hourlyPrice latitude longitude');

        if (!owner) {
            return Helper.response("Failed", "Owner not found", {}, res, 404);
        }

        Helper.response("Success", "Owner details retrieved successfully", owner, res, 200);

    } catch (error) {
        console.error('Get owner details error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = SearchController;
