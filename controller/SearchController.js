const Helper = require('../Helper/Helper');
const Register = require('../Models/RegisterModel');
const RegisteredVehicles = require('../Models/RegisteredVehicles');
const Availability = require('../Models/AvailabilityModel');
const Booking = require('../Models/BookingModel');
const Rentals = require('../Models/RegisterRentalModel');
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
        
        // Use RegisteredVehicles as primary model
        // City filter will be applied after populating registerId/rentalId
        let registeredVehiclesQuery = { verificationStatus: 'verified' };

        // Vehicle type filter with case-insensitive matching
        if (vehicleType && vehicleType !== 'all' && vehicleType !== 'All') {
            registeredVehiclesQuery.vehicleType = { $regex: new RegExp(`^${vehicleType}$`, 'i') };
        }

        // Price range filter
        if (minPrice || maxPrice) {
            registeredVehiclesQuery.rentalPrice = {};
            if (minPrice) registeredVehiclesQuery.rentalPrice.$gte = parseInt(minPrice);
            if (maxPrice) registeredVehiclesQuery.rentalPrice.$lte = parseInt(maxPrice);
        }

        // Location-based filter - will check after populate
        // Note: latitude/longitude might be in registerId or rentalId

        // Get available vehicles
        let availableVehicles = [];

        if (startDate && endDate) {
            // Check availability for date range
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Use RegisteredVehicles as primary model
            const registeredVehiclesQuery = { verificationStatus: 'verified' };
            if (vehicleType && vehicleType !== 'all' && vehicleType !== 'All') {
                registeredVehiclesQuery.vehicleType = { $regex: new RegExp(`^${vehicleType}$`, 'i') };
            }
            if (minPrice || maxPrice) {
                registeredVehiclesQuery.rentalPrice = {};
                if (minPrice) registeredVehiclesQuery.rentalPrice.$gte = parseInt(minPrice);
                if (maxPrice) registeredVehiclesQuery.rentalPrice.$lte = parseInt(maxPrice);
            }

            // Get all vehicles matching basic criteria from RegisteredVehicles
            const allRentals = await RegisteredVehicles.find(registeredVehiclesQuery)
                .select('userId registerId vehicleModel vehicleType rentalPrice vehiclePhoto additionalVehicles')
                .populate('registerId', 'Name City State Address ContactNo')
                .populate('rentalId', 'City State Address ContactNo businessName ownerName')
                .sort({ createdAt: -1 });

            // Flatten vehicles from main field and additionalVehicles array
            let allVehicles = [];
            for (const rental of allRentals) {
                const register = rental.registerId || {};
                const rentalInfo = rental.rentalId || {};
                
                // Apply city filter if specified
                if (city) {
                    const cityMatch = (register.City && new RegExp(city, 'i').test(register.City)) ||
                                     (rentalInfo.City && new RegExp(city, 'i').test(rentalInfo.City));
                    if (!cityMatch) continue;
                }
                
                // Add main vehicle
                if (rental.vehicleModel && rental.vehicleType) {
                    allVehicles.push({
                        _id: rental._id,
                        Name: register.Name || rental.userId?.username || 'N/A',
                        VehicleModel: rental.vehicleModel,
                        vehicleType: rental.vehicleType,
                        rentalPrice: rental.rentalPrice,
                        City: register.City || rentalInfo.City || 'N/A',
                        State: register.State || rentalInfo.State || 'N/A',
                        VehiclePhoto: rental.vehiclePhoto,
                        ContactNo: register.ContactNo || rentalInfo.ContactNo || rental.userId?.mobile || 'N/A',
                        Address: register.Address || rentalInfo.Address || 'N/A',
                        businessName: rentalInfo.businessName || '',
                        ownerName: rentalInfo.ownerName || '',
                        isMainVehicle: true
                    });
                }

                // Add additional vehicles
                if (rental.additionalVehicles && rental.additionalVehicles.length > 0) {
                    for (const additionalVehicle of rental.additionalVehicles) {
                        allVehicles.push({
                            _id: rental._id,
                            Name: register.Name || rental.userId?.username || 'N/A',
                            VehicleModel: additionalVehicle.model,
                            vehicleType: additionalVehicle.subcategory,
                            rentalPrice: additionalVehicle.rentalPrice,
                            City: register.City || rentalInfo.City || 'N/A',
                            State: register.State || rentalInfo.State || 'N/A',
                            VehiclePhoto: additionalVehicle.photo || rental.vehiclePhoto,
                            ContactNo: register.ContactNo || rentalInfo.ContactNo || rental.userId?.mobile || 'N/A',
                            Address: register.Address || rentalInfo.Address || 'N/A',
                            businessName: rentalInfo.businessName || '',
                            ownerName: rentalInfo.ownerName || '',
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
            // Use RegisteredVehicles as primary model for vehicle listings
            const registeredVehiclesQuery = { verificationStatus: 'verified' };
            
            // Apply filters to registered vehicles query
            if (vehicleType && vehicleType !== 'all' && vehicleType !== 'All') {
                registeredVehiclesQuery.vehicleType = { $regex: new RegExp(`^${vehicleType}$`, 'i') };
            }
            if (minPrice || maxPrice) {
                registeredVehiclesQuery.rentalPrice = {};
                if (minPrice) registeredVehiclesQuery.rentalPrice.$gte = parseInt(minPrice);
                if (maxPrice) registeredVehiclesQuery.rentalPrice.$lte = parseInt(maxPrice);
            }

            // Get verified vehicles from RegisteredVehicles model with personal details from Register
            const allRegisteredVehicles = await RegisteredVehicles.find(registeredVehiclesQuery)
                .select('userId registerId vehicleModel vehicleType category subcategory rentalPrice hourlyPrice vehiclePhoto licensePlate latitude longitude')
                .populate('userId', 'username email mobile')
                .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
                .populate('rentalId', 'City State Address latitude longitude ContactNo')
                .sort({ createdAt: -1 });

            // Filter out vehicles that are currently booked (today onwards)
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today

            availableVehicles = [];
            
            // Process RegisteredVehicles model vehicles (primary model)
            for (const vehicle of allRegisteredVehicles) {
                // Check if vehicle has any active bookings
                const activeBooking = await Booking.findOne({
                    vehicleId: vehicle._id,
                    status: { $in: ['pending', 'accepted', 'in_progress'] },
                    endDate: { $gte: today }
                });

                if (!activeBooking) {
                    // Get personal details from Register model (via registerId) or rentalId
                    const register = vehicle.registerId || {};
                    const rental = vehicle.rentalId || {};
                    
                    // Apply city filter if specified
                    if (city) {
                        const cityMatch = (register.City && new RegExp(city, 'i').test(register.City)) ||
                                         (rental.City && new RegExp(city, 'i').test(rental.City));
                        if (!cityMatch) continue;
                    }
                    
                    // Apply location filter if specified
                    if (latitude && longitude) {
                        const vehicleLat = vehicle.latitude || register.latitude || rental.latitude;
                        const vehicleLon = vehicle.longitude || register.longitude || rental.longitude;
                        if (!vehicleLat || !vehicleLon) continue;
                    }
                    
                    availableVehicles.push({
                        _id: vehicle._id,
                        Name: register.Name || vehicle.userId?.username || 'N/A',
                        VehicleModel: vehicle.vehicleModel,
                        vehicleType: vehicle.vehicleType,
                        category: vehicle.category,
                        subcategory: vehicle.subcategory,
                        rentalPrice: vehicle.rentalPrice,
                        hourlyPrice: vehicle.hourlyPrice,
                        City: register.City || rental.City || 'N/A',
                        State: register.State || rental.State || 'N/A',
                        VehiclePhoto: vehicle.vehiclePhoto,
                        ContactNo: register.ContactNo || rental.ContactNo || vehicle.userId?.mobile || 'N/A',
                        Address: register.Address || rental.Address || 'N/A',
                        Landmark: register.Landmark || rental.Landmark || '',
                        Pincode: register.Pincode || rental.Pincode || '',
                        latitude: vehicle.latitude || register.latitude || rental.latitude,
                        longitude: vehicle.longitude || register.longitude || rental.longitude,
                        licensePlate: vehicle.licensePlate,
                        source: 'registered'
                    });
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

                // Check if vehicle is a Mongoose document or plain object
                const vehicleData = vehicle.toObject ? vehicle.toObject() : vehicle;

                return {
                    ...vehicleData,
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

        // Use RegisteredVehicles as primary model
        const registeredVehicle = await RegisteredVehicles.findOne({
            _id: vehicleId,
            verificationStatus: 'verified'
        })
        .populate('userId', 'username email mobile')
        .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
        .populate('rentalId', 'City State Address Landmark Pincode latitude longitude ContactNo');

        let vehicle = null;
        if (registeredVehicle) {
            const register = registeredVehicle.registerId || {};
            const rental = registeredVehicle.rentalId || {};
            vehicle = {
                _id: registeredVehicle._id,
                Name: register.Name || registeredVehicle.userId?.username || 'N/A',
                VehicleModel: registeredVehicle.vehicleModel,
                vehicleType: registeredVehicle.vehicleType,
                category: registeredVehicle.category,
                subcategory: registeredVehicle.subcategory,
                rentalPrice: registeredVehicle.rentalPrice,
                hourlyPrice: registeredVehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                VehiclePhoto: registeredVehicle.vehiclePhoto,
                ContactNo: register.ContactNo || rental.ContactNo || registeredVehicle.userId?.mobile || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                Landmark: register.Landmark || rental.Landmark || '',
                Pincode: register.Pincode || rental.Pincode || '',
                latitude: registeredVehicle.latitude || register.latitude || rental.latitude,
                longitude: registeredVehicle.longitude || register.longitude || rental.longitude,
                licensePlate: registeredVehicle.licensePlate,
                source: 'registered',
                verificationStatus: registeredVehicle.verificationStatus
            };
        }

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found or not verified", {}, res, 404);
        }

        // Get availability for next 30 days
        const availability = await Availability.find({
            vehicleId: vehicleId,
            date: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
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
        // Use RegisteredVehicles as primary model and lookup City from Register via registerId
        // First, get all verified vehicles with populated registerId and rentalId
        const vehicles = await RegisteredVehicles.find({ verificationStatus: 'verified' })
            .populate('registerId', 'City')
            .populate('rentalId', 'City')
            .select('registerId rentalId')
            .lean();

        // Extract cities from registerId or rentalId
        const cityCounts = {};
        for (const vehicle of vehicles) {
            const city = vehicle.registerId?.City || vehicle.rentalId?.City;
            if (city) {
                cityCounts[city] = (cityCounts[city] || 0) + 1;
            }
        }

        // Convert to array and sort
        const cities = Object.entries(cityCounts)
            .map(([city, vehicleCount]) => ({ city, vehicleCount }))
            .sort((a, b) => b.vehicleCount - a.vehicleCount)
            .slice(0, 10);

        Helper.response("Success", "Popular cities retrieved successfully", { cities }, res, 200);

    } catch (error) {
        console.error('Get popular cities error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get vehicle types
SearchController.getVehicleTypes = async (req, res) => {
    try {
        // Use RegisteredVehicles as primary model
        const vehicleTypes = await RegisteredVehicles.aggregate([
            {
                $match: { verificationStatus: 'verified' } // Only count verified vehicles
            },
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

        // Use RegisteredVehicles as primary model for vehicle listings
        const registeredVehiclesQuery = { verificationStatus: 'verified' };

        // Category filter (2-wheeler or 4-wheeler)
        if (category && category !== 'all' && category !== 'All') {
            const categoryLower = category.toLowerCase();

            if (categoryLower === '2-wheeler' || categoryLower === '2wheeler') {
                registeredVehiclesQuery.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } }
                ];
            } else if (categoryLower === '4-wheeler' || categoryLower === '4wheeler') {
                registeredVehiclesQuery.$or = [
                    { category: { $in: ['4-wheeler', '4-Wheeler'] } }
                ];
            } else if (categoryLower === 'bike') {
                registeredVehiclesQuery.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } }
                ];
                registeredVehiclesQuery.subcategory = { $in: ['bike', 'Bike', 'BIKE'] };
            } else if (categoryLower === 'scooty') {
                registeredVehiclesQuery.$or = [
                    { category: { $in: ['2-wheeler', '2-Wheeler'] } }
                ];
                registeredVehiclesQuery.subcategory = { $in: ['scooty', 'Scooty', 'scooter', 'Scooter'] };
            } else if (categoryLower === 'car') {
                registeredVehiclesQuery.$or = [
                    { category: { $in: ['4-wheeler', '4-Wheeler'] } }
                ];
            } else {
                // Direct match for specific vehicle types
                registeredVehiclesQuery.vehicleType = { $regex: new RegExp(`^${category}$`, 'i') };
            }
        }

        // Subcategory filter
        if (subcategory && subcategory !== 'all' && subcategory !== 'All') {
            registeredVehiclesQuery.subcategory = { $regex: new RegExp(`^${subcategory}$`, 'i') };
        }

        // City filter - will be applied after populating registerId/rentalId
        // Note: City is in Register or RegisterRental, not in RegisteredVehicles directly

        // Price range filter
        if (minPrice || maxPrice) {
            registeredVehiclesQuery.rentalPrice = {};
            if (minPrice) registeredVehiclesQuery.rentalPrice.$gte = parseInt(minPrice);
            if (maxPrice) registeredVehiclesQuery.rentalPrice.$lte = parseInt(maxPrice);
        }

        // Location-based filter - will check after populate
        // Note: latitude/longitude might be in registerId or rentalId

        // Get verified vehicles from RegisteredVehicles model with personal details from Register
        const allRegisteredVehicles = await RegisteredVehicles.find(registeredVehiclesQuery)
            .select('userId registerId vehicleModel vehicleType category subcategory rentalPrice hourlyPrice vehiclePhoto licensePlate latitude longitude additionalVehicles')
            .populate('userId', 'username email mobile')
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
            .populate('rentalId', 'City State Address Landmark Pincode latitude longitude ContactNo')
            .sort({ createdAt: -1 });

        console.log(`Found ${allRegisteredVehicles.length} registered vehicles for category: ${category}`);
        console.log('Query used:', JSON.stringify(registeredVehiclesQuery, null, 2));

        // Flatten vehicles from main field and additionalVehicles array
        let allVehicles = [];
        
        // Process RegisteredVehicles model vehicles (primary model)
        for (const vehicle of allRegisteredVehicles) {
            // Get personal details from Register model (via registerId) or rentalId
            const register = vehicle.registerId || {};
            const rental = vehicle.rentalId || {};
            
            // Apply city filter if specified
            if (city) {
                const cityMatch = (register.City && new RegExp(city, 'i').test(register.City)) ||
                                 (rental.City && new RegExp(city, 'i').test(rental.City));
                if (!cityMatch) continue;
            }
            
            // Apply location filter if specified
            if (latitude && longitude) {
                const vehicleLat = vehicle.latitude || register.latitude || rental.latitude;
                const vehicleLon = vehicle.longitude || register.longitude || rental.longitude;
                if (!vehicleLat || !vehicleLon) continue;
            }
            
            // Add main vehicle
                allVehicles.push({
                _id: vehicle._id,
                Name: register.Name || vehicle.userId?.username || 'N/A',
                VehicleModel: vehicle.vehicleModel,
                vehicleType: vehicle.vehicleType,
                category: vehicle.category,
                subcategory: vehicle.subcategory,
                rentalPrice: vehicle.rentalPrice,
                hourlyPrice: vehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                VehiclePhoto: vehicle.vehiclePhoto,
                ContactNo: register.ContactNo || rental.ContactNo || vehicle.userId?.mobile || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                Landmark: register.Landmark || rental.Landmark || '',
                Pincode: register.Pincode || rental.Pincode || '',
                latitude: vehicle.latitude || register.latitude || rental.latitude,
                longitude: vehicle.longitude || register.longitude || rental.longitude,
                licensePlate: vehicle.licensePlate,
                isMainVehicle: true,
                source: 'registered'
            });

            // Add additional vehicles if any
            if (vehicle.additionalVehicles && vehicle.additionalVehicles.length > 0) {
                for (const additionalVehicle of vehicle.additionalVehicles) {
                    allVehicles.push({
                        _id: vehicle._id,
                        Name: register.Name || vehicle.userId?.username || 'N/A',
                        VehicleModel: additionalVehicle.model,
                        vehicleType: additionalVehicle.subcategory,
                        category: additionalVehicle.category,
                        subcategory: additionalVehicle.subcategory,
                        rentalPrice: additionalVehicle.rentalPrice,
                        hourlyPrice: null,
                        City: register.City || rental.City || 'N/A',
                        State: register.State || rental.State || 'N/A',
                        VehiclePhoto: additionalVehicle.photo || vehicle.vehiclePhoto,
                        ContactNo: register.ContactNo || rental.ContactNo || vehicle.userId?.mobile || 'N/A',
                        Address: register.Address || rental.Address || 'N/A',
                        Landmark: register.Landmark || rental.Landmark || '',
                        Pincode: register.Pincode || rental.Pincode || '',
                        latitude: vehicle.latitude || register.latitude || rental.latitude,
                        longitude: vehicle.longitude || register.longitude || rental.longitude,
                        isMainVehicle: false,
                        additionalVehicleId: additionalVehicle._id,
                        source: 'registered'
                    });
                }
            }
        }

        console.log(`Total vehicles found: ${allVehicles.length} (including additional vehicles and registered vehicles)`);

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
                    ...vehicle,
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
        // Use RegisteredVehicles as primary model
        const categories = await RegisteredVehicles.aggregate([
            {
                $match: { verificationStatus: 'verified' } // Only count verified vehicles
            },
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

        // Use RegisteredVehicles as primary model and get owner details from Register
        const registeredVehicle = await RegisteredVehicles.findOne({
            _id: vehicleId,
            verificationStatus: 'verified'
        })
        .populate('userId', 'username email mobile')
        .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
        .populate('rentalId', 'City State Address Landmark Pincode latitude longitude ContactNo');

        let owner = null;
        if (registeredVehicle) {
            const register = registeredVehicle.registerId || {};
            const rental = registeredVehicle.rentalId || {};
            owner = {
                Name: register.Name || registeredVehicle.userId?.username || 'N/A',
                Age: register.Age || null,
                ContactNo: register.ContactNo || rental.ContactNo || registeredVehicle.userId?.mobile || 'N/A',
                VehicleModel: registeredVehicle.vehicleModel,
                rentalPrice: registeredVehicle.rentalPrice,
                hourlyPrice: registeredVehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                Landmark: register.Landmark || rental.Landmark || '',
                Pincode: register.Pincode || rental.Pincode || '',
                latitude: registeredVehicle.latitude || register.latitude || rental.latitude,
                longitude: registeredVehicle.longitude || register.longitude || rental.longitude,
                source: 'registered'
            };
        }

        if (!owner) {
            return Helper.response("Failed", "Owner not found or vehicle not verified", {}, res, 404);
        }

        Helper.response("Success", "Owner details retrieved successfully", owner, res, 200);

    } catch (error) {
        console.error('Get owner details error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Check vehicle availability for specific date range
SearchController.checkAvailability = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate, pricingType = 'daily' } = req.body;

        // Validation
        if (!vehicleId || !startDate) {
            return Helper.response("Failed", "Missing required fields (vehicleId, startDate)", {}, res, 400);
        }

        // Parse dates
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : start; // If no end date, check only start date

        // Validate dates
        if (isNaN(start.getTime())) {
            return Helper.response("Failed", "Invalid start date format", {}, res, 400);
        }
        if (endDate && isNaN(end.getTime())) {
            return Helper.response("Failed", "Invalid end date format", {}, res, 400);
        }

        // Use RegisteredVehicles as primary model
        const registeredVehicle = await RegisteredVehicles.findOne({
            _id: vehicleId,
            verificationStatus: 'verified'
        })
        .populate('registerId', 'City State')
        .populate('rentalId', 'City State');
        
        let vehicle = null;
        if (registeredVehicle) {
            const register = registeredVehicle.registerId || {};
            const rental = registeredVehicle.rentalId || {};
            vehicle = {
                _id: registeredVehicle._id,
                VehicleModel: registeredVehicle.vehicleModel,
                vehicleType: registeredVehicle.vehicleType,
                rentalPrice: registeredVehicle.rentalPrice,
                hourlyPrice: registeredVehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                isAvailable: registeredVehicle.isAvailable !== false,
                source: 'registered'
            };
        }
        
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found or not verified", {}, res, 404);
        }

        // Check if vehicle is generally available
        if (vehicle.isAvailable === false) {
            return Helper.response("Success", "Vehicle availability checked", {
                isAvailable: false,
                reason: "Vehicle is currently unavailable",
                vehicleId: vehicleId,
                startDate: start,
                endDate: end,
                pricingType: pricingType
            }, res, 200);
        }

        // Check availability for each day in the range
        const availabilityIssues = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // Skip past dates
            if (d < today) {
                continue;
            }

            // Check availability record
            const availability = await Availability.findOne({
                vehicleId: vehicleId,
                date: d,
                isAvailable: false
            });

            if (availability) {
                availabilityIssues.push({
                    date: d,
                    reason: availability.reason || 'unavailable',
                    customReason: availability.customReason || ''
                });
            }

            // Check for active bookings
            const activeBooking = await Booking.findOne({
                vehicleId: vehicleId,
                status: { $in: ['pending', 'accepted', 'in_progress'] },
                $or: [
                    {
                        startDate: { $lte: d },
                        endDate: { $gte: d }
                    },
                    {
                        startDate: d
                    }
                ]
            });

            if (activeBooking) {
                availabilityIssues.push({
                    date: d,
                    reason: 'booked',
                    customReason: `Booked by ${activeBooking.renterName}`
                });
            }
        }

        const isAvailable = availabilityIssues.length === 0;

        Helper.response("Success", "Vehicle availability checked", {
            isAvailable: isAvailable,
            vehicleId: vehicleId,
            startDate: start,
            endDate: end,
            pricingType: pricingType,
            availabilityIssues: availabilityIssues,
            vehicle: {
                _id: vehicle._id,
                VehicleModel: vehicle.vehicleModel || vehicle.VehicleModel,
                vehicleType: vehicle.vehicleType,
                rentalPrice: vehicle.rentalPrice,
                hourlyPrice: vehicle.hourlyPrice,
                City: vehicle.City || (vehicle.registerId?.City) || (vehicle.rentalId?.City) || 'N/A',
                State: vehicle.State || (vehicle.registerId?.State) || (vehicle.rentalId?.State) || 'N/A'
            }
        }, res, 200);

    } catch (error) {
        console.error('Check availability error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

SearchController.getRentals=async (req, res) => {
    try {
        const { latitude, longitude, radius = 5000 } = req.body;
        
        if (!latitude || !longitude) {
            return Helper.response("Failed", "Missing latitude or longitude", {}, res, 400);
        }
        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        const radiusInKm = parseFloat(radius);
        
        // Find all verified vehicles from RegisteredVehicles with rentalId (rental businesses)
        // Populate registerId and rentalId for location data
        const rentals = await RegisteredVehicles.find({
            verificationStatus: 'verified',
            rentalId: { $ne: null } // Only vehicles linked to rental businesses
        })
        .populate('registerId', 'Name City State Address ContactNo latitude longitude')
        .populate('rentalId', 'City State Address ContactNo latitude longitude')
        .select('vehicleModel vehicleType rentalPrice vehiclePhoto licensePlate');
        
        // Calculate distance and filter by radius
        const nearbyRentals = [];
        for (const rental of rentals) {
            const register = rental.registerId || {};
            const rentalInfo = rental.rentalId || {};
            
            // Get location from registerId or rentalId
            const vehicleLat = register.latitude || rentalInfo.latitude;
            const vehicleLon = register.longitude || rentalInfo.longitude;
            
            if (!vehicleLat || !vehicleLon) continue;
            
            const distance = calculateDistance(userLat, userLon, vehicleLat, vehicleLon);
            
            if (distance <= radiusInKm) {
                nearbyRentals.push({
                    _id: rental._id,
                    Name: register.Name || rentalInfo.ownerName || 'N/A',
                    VehicleModel: rental.vehicleModel,
                    vehicleType: rental.vehicleType,
                    rentalPrice: rental.rentalPrice,
                    City: register.City || rentalInfo.City || 'N/A',
                    State: register.State || rentalInfo.State || 'N/A',
                    VehiclePhoto: rental.vehiclePhoto,
                    ContactNo: register.ContactNo || rentalInfo.ContactNo || 'N/A',
                    Address: register.Address || rentalInfo.Address || 'N/A',
                    latitude: vehicleLat,
                    longitude: vehicleLon,
                distance: parseFloat(distance.toFixed(2))
                });
            }
        }
        
        // Sort by distance
        nearbyRentals.sort((a, b) => a.distance - b.distance);
        
         Helper.response("Success", "Nearby rentals retrieved successfully", { rentals: nearbyRentals }, res, 200);
    }
        catch (error) {
        console.error('Get rentals nearby error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};


module.exports = SearchController;
