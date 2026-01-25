const mongoose = require('mongoose');
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
            radius = 50000, // Default radius in meters
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
                        VehicleModel: rental.vehicleModel, // Backward compatibility
                        vehicleModel: rental.vehicleModel, // New field name
                        vehicleType: rental.vehicleType,
                        rentalPrice: rental.rentalPrice,
                        City: register.City || rentalInfo.City || 'N/A',
                        State: register.State || rentalInfo.State || 'N/A',
                        VehiclePhoto: rental.vehiclePhoto, // Backward compatibility
                        vehiclePhoto: rental.vehiclePhoto, // New field name
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
                            VehicleModel: additionalVehicle.model, // Backward compatibility
                            vehicleModel: additionalVehicle.model, // New field name
                            vehicleType: additionalVehicle.subcategory,
                            rentalPrice: additionalVehicle.rentalPrice,
                            City: register.City || rentalInfo.City || 'N/A',
                            State: register.State || rentalInfo.State || 'N/A',
                            VehiclePhoto: additionalVehicle.photo || rental.vehiclePhoto, // Backward compatibility
                            vehiclePhoto: additionalVehicle.photo || rental.vehiclePhoto, // New field name
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
                        VehicleModel: vehicle.vehicleModel, // Backward compatibility
                        vehicleModel: vehicle.vehicleModel, // New field name
                        vehicleType: vehicle.vehicleType,
                        category: vehicle.category,
                        subcategory: vehicle.subcategory,
                        rentalPrice: vehicle.rentalPrice,
                        hourlyPrice: vehicle.hourlyPrice,
                        City: register.City || rental.City || 'N/A',
                        State: register.State || rental.State || 'N/A',
                        VehiclePhoto: vehicle.vehiclePhoto, // Backward compatibility
                        vehiclePhoto: vehicle.vehiclePhoto, // New field name
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
        // Calculate distance for each vehicle if user location is provided
        if (latitude && longitude) {
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);
            const radiusInKm = parseFloat(radius) / 1000;

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
                VehicleModel: registeredVehicle.vehicleModel, // Keep for backward compatibility
                vehicleModel: registeredVehicle.vehicleModel, // New field name
                vehicleType: registeredVehicle.vehicleType,
                category: registeredVehicle.category,
                subcategory: registeredVehicle.subcategory,
                rentalPrice: registeredVehicle.rentalPrice,
                hourlyPrice: registeredVehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                VehiclePhoto: registeredVehicle.vehiclePhoto, // Keep for backward compatibility
                vehiclePhoto: registeredVehicle.vehiclePhoto, // New field name
                ContactNo: register.ContactNo || rental.ContactNo || registeredVehicle.userId?.mobile || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                Landmark: register.Landmark || rental.Landmark || '',
                Pincode: register.Pincode || rental.Pincode || '',
                latitude: registeredVehicle.latitude || register.latitude || rental.latitude,
                longitude: registeredVehicle.longitude || register.longitude || rental.longitude,
                licensePlate: registeredVehicle.licensePlate,
                source: 'registered',
                verificationStatus: registeredVehicle.verificationStatus,
                securityDeposit: registeredVehicle.securityDeposit,
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
            radius = 50000, // Default 50km in meters
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
                VehicleModel: vehicle.vehicleModel, // Backward compatibility
                vehicleModel: vehicle.vehicleModel, // New field name
                vehicleType: vehicle.vehicleType,
                category: vehicle.category,
                subcategory: vehicle.subcategory,
                rentalPrice: vehicle.rentalPrice,
                hourlyPrice: vehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                VehiclePhoto: vehicle.vehiclePhoto, // Backward compatibility
                vehiclePhoto: vehicle.vehiclePhoto, // New field name
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
                        VehicleModel: additionalVehicle.model, // Backward compatibility
                        vehicleModel: additionalVehicle.model, // New field name
                        vehicleType: additionalVehicle.subcategory,
                        category: additionalVehicle.category,
                        subcategory: additionalVehicle.subcategory,
                        rentalPrice: additionalVehicle.rentalPrice,
                        hourlyPrice: null,
                        City: register.City || rental.City || 'N/A',
                        State: register.State || rental.State || 'N/A',
                        VehiclePhoto: additionalVehicle.photo || vehicle.vehiclePhoto, // Backward compatibility
                        vehiclePhoto: additionalVehicle.photo || vehicle.vehiclePhoto, // New field name
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
            const radiusInKm = parseFloat(radius) / 1000;

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

        const registeredVehicle = await RegisteredVehicles.findOne({
            _id: vehicleId,
            verificationStatus: 'verified'
        })
            .populate('userId', 'username email mobile')
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude userId')
            .populate('rentalId', 'City State Address Landmark Pincode latitude longitude ContactNo userId');

        let owner = null;
        if (registeredVehicle) {
            const register = registeredVehicle.registerId || {};
            const rental = registeredVehicle.rentalId || {};

            // Extract User ID safely
            let ownerUserId = null;
            if (registeredVehicle.userId) {
                ownerUserId = registeredVehicle.userId._id ? registeredVehicle.userId._id : registeredVehicle.userId;
            }
            if (!ownerUserId && register.userId) ownerUserId = register.userId;
            if (!ownerUserId && rental.userId) ownerUserId = rental.userId;

            console.log('Detected Owner User ID:', ownerUserId);

            owner = {
                Name: register.Name || registeredVehicle.userId?.username || rental.ownerName || 'Zugo Host',
                Age: register.Age || null,
                ContactNo: register.ContactNo || rental.ContactNo || registeredVehicle.userId?.mobile || 'N/A',
                VehicleModel: registeredVehicle.vehicleModel, // Backward compatibility
                vehicleModel: registeredVehicle.vehicleModel, // New field name
                rentalPrice: registeredVehicle.rentalPrice,
                hourlyPrice: registeredVehicle.hourlyPrice,
                City: register.City || rental.City || 'N/A',
                State: register.State || rental.State || 'N/A',
                Address: register.Address || rental.Address || 'N/A',
                Landmark: register.Landmark || rental.Landmark || '',
                Pincode: register.Pincode || rental.Pincode || '',
                latitude: registeredVehicle.latitude || register.latitude || rental.latitude,
                longitude: registeredVehicle.longitude || register.longitude || rental.longitude,
                source: 'registered',
                userId: ownerUserId // Include userId for linking to host profile
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
                VehicleModel: vehicle.vehicleModel || vehicle.VehicleModel, // Backward compatibility
                vehicleModel: vehicle.vehicleModel || vehicle.VehicleModel, // New field name
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

SearchController.getRentals = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50000, page = 1, limit = 20, city, excludeId } = req.query;

        // Validation - Require either filtering by Location OR City
        if ((!latitude || !longitude) && !city) {
            return Helper.response("Failed", "Missing location data (latitude/longitude OR city)", {}, res, 400);
        }

        const userLat = latitude ? parseFloat(latitude) : null;
        const userLon = longitude ? parseFloat(longitude) : null;
        const radiusInKm = parseFloat(radius) / 1000;
        const skip = (page - 1) * limit;

        // Find all verified vehicles from RegisteredVehicles with rentalId (rental businesses)
        // We need to aggregate to find unique rentalIds first or fetch all and filter in JS (easier for complex populations)
        // Given complexity of populations, we'll fetch vehicles and deduplicate in JS for now
        // A more efficient way for large datasets would be an aggregation pipeline

        let query = {
            verificationStatus: 'verified',
            rentalId: { $ne: null }, // Only vehicles linked to rental businesses
            isAvailable: true
        };

        // If filtering by excludeId (exclude current rental)
        if (excludeId) {
            // Note: We can't easily filter by rentalId._id here because rentalId is a ref in the schema
            // We will filter it out in the loop below
        }

        // If filtering by City, we might want to pre-filter if possible, but City is in populated fields
        // So we handle it in the loop or use a more complex query if we had denormalized data

        const vehicles = await RegisteredVehicles.find(query)
            .populate('registerId', 'Name City State Address Landmark Pincode ContactNo latitude longitude')
            .populate('rentalId', 'businessName ownerName City State Address Landmark Pincode ContactNo latitude longitude rentalImage')
            .sort({ createdAt: -1 });

        // Map key: rentalId (string) -> Rental Object
        const rentalMap = new Map();

        for (const vehicle of vehicles) {
            if (!vehicle.rentalId) continue;

            // Handle rentalId being populated or string
            const rentalIdObj = vehicle.rentalId;
            const rentalIdStr = rentalIdObj._id ? rentalIdObj._id.toString() : rentalIdObj.toString();

            // Exclude specific rental ID if requested
            if (excludeId && rentalIdStr === excludeId) continue;

            // Skip if already processed
            if (rentalMap.has(rentalIdStr)) {
                // Update vehicle count or low price if needed
                const existing = rentalMap.get(rentalIdStr);
                existing.vehicleCount += 1;
                // Keep the lowest price found
                if (vehicle.rentalPrice < existing.rentalPrice) {
                    existing.rentalPrice = vehicle.rentalPrice;
                    existing.formattedPrice = `₹${vehicle.rentalPrice}/day`;
                }
                continue;
            }

            const register = vehicle.registerId || {};
            const rentalInfo = rentalIdObj; // It's populated

            // Get business details
            const businessName = rentalInfo.businessName || rentalInfo.ownerName || register.Name || 'N/A';
            const rentalCity = register.City || rentalInfo.City || 'N/A';
            const rentalState = register.State || rentalInfo.State || 'N/A';
            const location = rentalCity !== 'N/A' && rentalState !== 'N/A' ? `${rentalCity}, ${rentalState}` : rentalCity;

            // Location filtering logic
            let distance = null;
            let includeRental = false;

            // Strategy 1: Location based (if lat/long provided)
            if (userLat && userLon) {
                const vehicleLat = register.latitude || rentalInfo.latitude;
                const vehicleLon = register.longitude || rentalInfo.longitude;

                if (vehicleLat && vehicleLon) {
                    distance = calculateDistance(userLat, userLon, vehicleLat, vehicleLon);
                    if (distance <= radiusInKm) {
                        includeRental = true;
                    }
                }
            }
            // Strategy 2: City based (fallback or explicit)
            else if (city) {
                // simple Case-insensitive match
                if (rentalCity.toLowerCase() === city.toLowerCase()) {
                    includeRental = true;
                    distance = 0; // Unknown distance but in same city
                }
            }

            if (includeRental) {
                // Create rental entry
                rentalMap.set(rentalIdStr, {
                    _id: rentalIdStr, // Using rentalId as the main ID for the card
                    rentalId: rentalIdStr,
                    businessName: businessName,
                    ownerName: rentalInfo.ownerName || register.Name || 'N/A',
                    location: location,
                    City: rentalCity,
                    State: rentalState,
                    Address: register.Address || rentalInfo.Address || 'N/A',

                    // Location
                    latitude: register.latitude || rentalInfo.latitude,
                    longitude: register.longitude || rentalInfo.longitude,
                    distance: distance !== null ? parseFloat(distance.toFixed(2)) : null,

                    // Display Info
                    vehicleCount: 1, // Start with 1
                    vehiclePhoto: vehicle.vehiclePhoto, // Use first vehicle found as placeholder if rental image not available
                    rentalImage: rentalInfo.rentalImage, // PROMOTED: Rental Business Image

                    // Pricing (Starts from)
                    rentalPrice: vehicle.rentalPrice,
                    formattedPrice: `₹${vehicle.rentalPrice}/day`,

                    // Rating (Mock for now)
                    rating: 4.5,
                    reviewCount: 274,

                    // Contact
                    ContactNo: register.ContactNo || rentalInfo.ContactNo || 'N/A'
                });
            }
        }

        // Convert map to array and sort
        const nearbyRentals = Array.from(rentalMap.values());
        nearbyRentals.sort((a, b) => a.distance - b.distance);

        // Pagination
        const totalCount = nearbyRentals.length;
        const paginatedRentals = nearbyRentals.slice(skip, skip + parseInt(limit));

        Helper.response("Success", "Nearby rental businesses retrieved successfully", {
            rentals: paginatedRentals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasNextPage: skip + parseInt(limit) < totalCount,
                hasPrevPage: page > 1
            },
            userLocation: {
                latitude: userLat,
                longitude: userLon,
                radius: radiusInKm
            }
        }, res, 200);

    } catch (error) {
        console.error('Get rentals nearby error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};


// Get all vehicles for a specific rental business
SearchController.getRentalVehicles = async (req, res) => {
    try {
        const { rentalId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        if (!rentalId) {
            return Helper.response("Failed", "Missing rentalId parameter", {}, res, 400);
        }

        // Validate rentalId format (MongoDB ObjectId)
        if (!mongoose.Types.ObjectId.isValid(rentalId)) {
            return Helper.response("Failed", "Invalid rentalId format", {}, res, 400);
        }

        // Find all verified vehicles for this rental business
        const vehicles = await RegisteredVehicles.find({
            rentalId: rentalId,
            verificationStatus: 'verified',
            isAvailable: true
        })
            .populate('userId', 'username email mobile')
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
            .populate('rentalId', 'businessName ownerName City State Address Landmark Pincode ContactNo latitude longitude')
            .select('vehicleModel vehicleType vehicleMake category subcategory rentalPrice hourlyPrice vehiclePhoto licensePlate additionalVehicles ReturnDuration createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalCount = await RegisteredVehicles.countDocuments({
            rentalId: rentalId,
            verificationStatus: 'verified',
            isAvailable: true
        });

        // Get rental business details
        const rentalBusiness = await Rentals.findById(rentalId);

        if (!rentalBusiness) {
            return Helper.response("Failed", "Rental business not found", {}, res, 404);
        }

        // Format vehicles response including additional vehicles
        const formattedVehicles = [];

        for (const vehicle of vehicles) {
            const register = vehicle.registerId || {};
            const rentalInfo = vehicle.rentalId || {};

            // Get business name
            const businessName = rentalInfo.businessName || rentalBusiness.businessName || 'N/A';

            // Format location
            const city = register.City || rentalInfo.City || rentalBusiness.City || 'N/A';
            const state = register.State || rentalInfo.State || rentalBusiness.State || 'N/A';
            const location = city !== 'N/A' && state !== 'N/A' ? `${city}, ${state}` : city;

            // Default rating (can be enhanced with actual rating system)
            const rating = 4.5;
            const reviewCount = 274;

            // Format price
            const pricePerDay = vehicle.rentalPrice || 0;
            const formattedPrice = `₹${pricePerDay}/day`;

            // Add main vehicle
            formattedVehicles.push({
                _id: vehicle._id,
                // Business/Provider Information
                businessName: businessName,
                providerName: businessName,
                ownerName: rentalInfo.ownerName || rentalBusiness.ownerName || register.Name || 'N/A',

                // Location Information
                location: location,
                City: city,
                State: state,
                Address: register.Address || rentalInfo.Address || rentalBusiness.Address || 'N/A',
                Landmark: register.Landmark || rentalInfo.Landmark || rentalBusiness.Landmark || '',
                Pincode: register.Pincode || rentalInfo.Pincode || rentalBusiness.Pincode || '',
                latitude: register.latitude || rentalInfo.latitude || rentalBusiness.latitude,
                longitude: register.longitude || rentalInfo.longitude || rentalBusiness.longitude,

                // Vehicle Information
                VehicleModel: vehicle.vehicleModel,
                vehicleModel: vehicle.vehicleModel,
                vehicleMake: vehicle.vehicleMake || '',
                vehicleType: vehicle.vehicleType,
                category: vehicle.category,
                subcategory: vehicle.subcategory,
                licensePlate: vehicle.licensePlate,

                // Pricing Information
                rentalPrice: vehicle.rentalPrice,
                hourlyPrice: vehicle.hourlyPrice,
                pricePerDay: formattedPrice,
                price: pricePerDay,

                // Media
                VehiclePhoto: vehicle.vehiclePhoto,
                vehiclePhoto: vehicle.vehiclePhoto,

                // Rating Information
                rating: rating,
                reviewCount: reviewCount,
                reviews: reviewCount,

                // Contact Information
                ContactNo: register.ContactNo || rentalInfo.ContactNo || rentalBusiness.ContactNo || vehicle.userId?.mobile || 'N/A',

                // Additional Information
                ReturnDuration: vehicle.ReturnDuration || 'Not specified',
                isMainVehicle: true,
                source: 'rental',
                hasAdditionalVehicles: vehicle.additionalVehicles && vehicle.additionalVehicles.length > 0,
                createdAt: vehicle.createdAt
            });

            // Add additional vehicles if they exist
            if (vehicle.additionalVehicles && vehicle.additionalVehicles.length > 0) {
                for (const additionalVehicle of vehicle.additionalVehicles) {
                    formattedVehicles.push({
                        _id: vehicle._id,
                        // Business/Provider Information
                        businessName: businessName,
                        providerName: businessName,
                        ownerName: rentalInfo.ownerName || rentalBusiness.ownerName || register.Name || 'N/A',

                        // Location Information
                        location: location,
                        City: city,
                        State: state,
                        Address: register.Address || rentalInfo.Address || rentalBusiness.Address || 'N/A',
                        Landmark: register.Landmark || rentalInfo.Landmark || rentalBusiness.Landmark || '',
                        Pincode: register.Pincode || rentalInfo.Pincode || rentalBusiness.Pincode || '',
                        latitude: register.latitude || rentalInfo.latitude || rentalBusiness.latitude,
                        longitude: register.longitude || rentalInfo.longitude || rentalBusiness.longitude,

                        // Vehicle Information
                        VehicleModel: additionalVehicle.model,
                        vehicleModel: additionalVehicle.model,
                        vehicleType: additionalVehicle.subcategory,
                        category: additionalVehicle.category,
                        subcategory: additionalVehicle.subcategory,
                        licensePlate: vehicle.licensePlate,

                        // Pricing Information
                        rentalPrice: additionalVehicle.rentalPrice,
                        hourlyPrice: null,
                        pricePerDay: `₹${additionalVehicle.rentalPrice}/day`,
                        price: additionalVehicle.rentalPrice,

                        // Media
                        VehiclePhoto: additionalVehicle.photo || vehicle.vehiclePhoto,
                        vehiclePhoto: additionalVehicle.photo || vehicle.vehiclePhoto,

                        // Rating Information
                        rating: rating,
                        reviewCount: reviewCount,
                        reviews: reviewCount,

                        // Contact Information
                        ContactNo: register.ContactNo || rentalInfo.ContactNo || rentalBusiness.ContactNo || vehicle.userId?.mobile || 'N/A',

                        // Additional Information
                        ReturnDuration: vehicle.ReturnDuration || 'Not specified',
                        isMainVehicle: false,
                        additionalVehicleId: additionalVehicle._id,
                        source: 'rental'
                    });
                }
            }
        }

        // Get rental business summary
        const rentalSummary = {
            _id: rentalBusiness._id,
            businessName: rentalBusiness.businessName,
            ownerName: rentalBusiness.ownerName,
            City: rentalBusiness.City,
            State: rentalBusiness.State,
            Address: rentalBusiness.Address,
            ContactNo: rentalBusiness.ContactNo,
            totalVehicles: totalCount,
            availableVehicles: formattedVehicles.length
        };

        Helper.response("Success", "Rental vehicles retrieved successfully", {
            rental: rentalSummary,
            vehicles: formattedVehicles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasNextPage: skip + parseInt(limit) < totalCount,
                hasPrevPage: page > 1
            }
        }, res, 200);

    } catch (error) {
        console.error('Get rental vehicles error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = SearchController;
