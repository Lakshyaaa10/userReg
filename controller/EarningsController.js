const Helper = require('../Helper/Helper');
const Earnings = require('../Models/EarningsModel');
const Booking = require('../Models/BookingModel');

const EarningsController = {};

// Get earnings for an owner
EarningsController.getOwnerEarnings = async (req, res) => {
    try {
        const { ownerId, page = 1, limit = 20, startDate, endDate } = req.query;

        if (!ownerId) {
            return Helper.response("Failed", "Missing ownerId", {}, res, 400);
        }

        const skip = (page - 1) * limit;
        let query = { ownerId };

        // Add date filter if provided
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const earnings = await Earnings.find(query)
            .populate('bookingId', 'renterName vehicleModel startDate endDate')
            .populate('vehicleId', 'VehicleModel vehicleType')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Calculate total earnings
        const totalEarnings = await Earnings.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalGrossAmount: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 }
                }
            }
        ]);

        const totalCount = await Earnings.countDocuments(query);

        Helper.response("Success", "Earnings retrieved successfully", {
            earnings,
            summary: totalEarnings[0] || {
                totalGrossAmount: 0,
                totalPlatformFee: 0,
                totalNetAmount: 0,
                totalTrips: 0
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get owner earnings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get earnings summary for dashboard
EarningsController.getEarningsSummary = async (req, res) => {
    try {
        const { ownerId, period = 'month' } = req.query; // period: 'week', 'month', 'year'

        if (!ownerId) {
            return Helper.response("Failed", "Missing ownerId", {}, res, 400);
        }

        let dateFilter = {};
        const now = new Date();

        switch (period) {
            case 'week':
                dateFilter = {
                    $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                };
                break;
            case 'month':
                dateFilter = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1)
                };
                break;
            case 'year':
                dateFilter = {
                    $gte: new Date(now.getFullYear(), 0, 1)
                };
                break;
        }

        const summary = await Earnings.aggregate([
            {
                $match: {
                    ownerId: require('mongoose').Types.ObjectId(ownerId),
                    createdAt: dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    totalGrossAmount: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 },
                    averageEarningPerTrip: { $avg: '$netAmount' }
                }
            }
        ]);

        // Get monthly earnings for chart data
        const monthlyEarnings = await Earnings.aggregate([
            {
                $match: {
                    ownerId: require('mongoose').Types.ObjectId(ownerId),
                    createdAt: { $gte: new Date(now.getFullYear(), 0, 1) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        Helper.response("Success", "Earnings summary retrieved successfully", {
            summary: summary[0] || {
                totalGrossAmount: 0,
                totalPlatformFee: 0,
                totalNetAmount: 0,
                totalTrips: 0,
                averageEarningPerTrip: 0
            },
            monthlyEarnings
        }, res, 200);

    } catch (error) {
        console.error('Get earnings summary error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get top performing vehicles
EarningsController.getTopPerformingVehicles = async (req, res) => {
    try {
        const { ownerId, limit = 5 } = req.query;

        if (!ownerId) {
            return Helper.response("Failed", "Missing ownerId", {}, res, 400);
        }

        const topVehicles = await Earnings.aggregate([
            {
                $match: { ownerId: require('mongoose').Types.ObjectId(ownerId) }
            },
            {
                $group: {
                    _id: '$vehicleId',
                    totalEarnings: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 },
                    averageEarningPerTrip: { $avg: '$netAmount' }
                }
            },
            {
                $lookup: {
                    from: 'registers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vehicleDetails'
                }
            },
            {
                $unwind: '$vehicleDetails'
            },
            {
                $project: {
                    vehicleId: '$_id',
                    vehicleModel: '$vehicleDetails.VehicleModel',
                    vehicleType: '$vehicleDetails.vehicleType',
                    totalEarnings: 1,
                    totalTrips: 1,
                    averageEarningPerTrip: 1
                }
            },
            {
                $sort: { totalEarnings: -1 }
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        Helper.response("Success", "Top performing vehicles retrieved successfully", {
            topVehicles
        }, res, 200);

    } catch (error) {
        console.error('Get top performing vehicles error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get earnings analytics
EarningsController.getEarningsAnalytics = async (req, res) => {
    try {
        const { ownerId, startDate, endDate } = req.query;

        if (!ownerId) {
            return Helper.response("Failed", "Missing ownerId", {}, res, 400);
        }

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const analytics = await Earnings.aggregate([
            {
                $match: {
                    ownerId: require('mongoose').Types.ObjectId(ownerId),
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: null,
                    totalGrossAmount: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 },
                    averageEarningPerTrip: { $avg: '$netAmount' },
                    minEarning: { $min: '$netAmount' },
                    maxEarning: { $max: '$netAmount' }
                }
            }
        ]);

        // Get daily earnings for the period
        const dailyEarnings = await Earnings.aggregate([
            {
                $match: {
                    ownerId: require('mongoose').Types.ObjectId(ownerId),
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        Helper.response("Success", "Earnings analytics retrieved successfully", {
            analytics: analytics[0] || {
                totalGrossAmount: 0,
                totalPlatformFee: 0,
                totalNetAmount: 0,
                totalTrips: 0,
                averageEarningPerTrip: 0,
                minEarning: 0,
                maxEarning: 0
            },
            dailyEarnings
        }, res, 200);

    } catch (error) {
        console.error('Get earnings analytics error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = EarningsController;
