const Helper = require('../Helper/Helper');
const Register = require('../Models/RegisterModel');
const Availability = require('../Models/AvailabilityModel');

const SearchController = {};

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

        // Get available vehicles
        let availableVehicles = [];
        
        if (startDate && endDate) {
            // Check availability for date range
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Get all vehicles matching basic criteria
            const allVehicles = await Register.find(query)
                .select('Name VehicleModel vehicleType rentalPrice City State VehiclePhoto ContactNo Address')
                .sort({ createdAt: -1 });

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
            // No date filter, return all matching vehicles
            availableVehicles = await Register.find(query)
                .select('Name VehicleModel vehicleType rentalPrice City State VehiclePhoto ContactNo Address')
                .sort({ createdAt: -1 });
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
            }
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
            city,
            minPrice,
            maxPrice,
            page = 1,
            limit = 20
        } = req.query;

        const skip = (page - 1) * limit;
        let query = {};

        // Category filter with support for main categories and subcategories
        if (category && category !== 'all' && category !== 'All') {
            const categoryLower = category.toLowerCase();
            
            // Map frontend categories to database vehicle types
            if (categoryLower === 'bike') {
                query.vehicleType = { $in: ['bike', 'Bike', 'BIKE'] };
            } else if (categoryLower === 'scooty') {
                query.vehicleType = { $in: ['scooty', 'Scooty', 'SCOOTY', 'scooter', 'Scooter'] };
            } else if (categoryLower === 'car') {
                query.vehicleType = { $in: ['car', 'Car', 'CAR', 'sedan', 'Sedan', 'SUV', 'suv', 'hatchback', 'Hatchback'] };
            } else {
                // Direct match for specific vehicle types
                query.vehicleType = { $regex: new RegExp(`^${category}$`, 'i') };
            }
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

        // Get vehicles with pagination
        const vehicles = await Register.find(query)
            .select('Name VehicleModel vehicleType rentalPrice City State VehiclePhoto ContactNo Address Landmark Pincode latitude longitude')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Register.countDocuments(query);

        Helper.response("Success", "Vehicles retrieved successfully", {
            vehicles,
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
            }
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
            .select('Name Age Address Landmark Pincode City State ContactNo VehicleModel ReturnDuration rentalPrice latitude longitude');

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
