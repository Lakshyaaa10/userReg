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

        // Vehicle type filter
        if (vehicleType && vehicleType !== 'all') {
            query.vehicleType = vehicleType;
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

module.exports = SearchController;
