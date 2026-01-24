const jwt = require('jsonwebtoken');
const Helper = require('../Helper/Helper');
const Admin = require('../Models/AdminModel');
const DriverLicense = require('../Models/DriverLicenseModel');
const Booking = require('../Models/BookingModel');
const Notification = require('../Models/NotificationModel');

const AdminController = {};

// Admin registration
AdminController.adminRegister = async (req, res) => {
    try {
        console.log('Admin register controller called');
        console.log('Request body:', req.body);

        const {
            username,
            email,
            password,
            fullName,
            phone,
            role,
            permissions,
            rtoSpecialization,
            assignedRegions
        } = req.body;

        // Validate required fields
        if (!username || !email || !password || !fullName || !phone) {
            return Helper.response("Failed", "Missing required fields (username, email, password, fullName, phone)", {}, res, 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return Helper.response("Failed", "Invalid email format", {}, res, 400);
        }

        // Check if username already exists
        const existingUsername = await Admin.findOne({ username });
        if (existingUsername) {
            return Helper.response("Failed", "Username already exists", {}, res, 409);
        }

        // Check if email already exists
        const existingEmail = await Admin.findOne({ email });
        if (existingEmail) {
            return Helper.response("Failed", "Email already exists", {}, res, 409);
        }

        // Validate role if provided
        const validRoles = ['super_admin', 'admin', 'moderator', 'support'];
        if (role && !validRoles.includes(role)) {
            return Helper.response("Failed", `Invalid role. Must be one of: ${validRoles.join(', ')}`, {}, res, 400);
        }

        // Validate permissions if provided
        const validPermissions = ['manage_users', 'manage_vehicles', 'manage_bookings', 'manage_payments', 'manage_notifications', 'rto_assistance', 'view_analytics'];
        if (permissions && Array.isArray(permissions)) {
            const invalidPermissions = permissions.filter(perm => !validPermissions.includes(perm));
            if (invalidPermissions.length > 0) {
                return Helper.response("Failed", `Invalid permissions: ${invalidPermissions.join(', ')}`, {}, res, 400);
            }
        }

        // Validate RTO specialization if provided
        const validRTOSpecializations = ['registration', 'license', 'permit', 'fitness', 'insurance', 'pollution'];
        if (rtoSpecialization && Array.isArray(rtoSpecialization)) {
            const invalidSpecializations = rtoSpecialization.filter(spec => !validRTOSpecializations.includes(spec));
            if (invalidSpecializations.length > 0) {
                return Helper.response("Failed", `Invalid RTO specializations: ${invalidSpecializations.join(', ')}`, {}, res, 400);
            }
        }

        // Create new admin
        const newAdmin = new Admin({
            username,
            email,
            password, // In production, hash this password
            fullName,
            phone,
            role: role || 'admin',
            permissions: permissions || [],
            rtoSpecialization: rtoSpecialization || [],
            assignedRegions: assignedRegions || [],
            isActive: true
        });

        await newAdmin.save();

        Helper.response("Success", "Admin registered successfully", {
            adminId: newAdmin._id,
            username: newAdmin.username,
            email: newAdmin.email,
            fullName: newAdmin.fullName,
            role: newAdmin.role,
            permissions: newAdmin.permissions,
            createdAt: newAdmin.createdAt
        }, res, 201);

    } catch (error) {
        console.error('Admin registration error:', error);

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return Helper.response("Failed", `${field} already exists`, {}, res, 409);
        }

        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Admin login
AdminController.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return Helper.response("Failed", "Username and password required", {}, res, 400);
        }

        const admin = await Admin.findOne({ username, isActive: true });
        if (!admin || admin.password !== password) {
            return Helper.response("Failed", "Invalid credentials", {}, res, 401);
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: admin._id,
                username: admin.username,
                role: admin.role
            },
            process.env.SECRET_KEY,
            { expiresIn: "50m" }
        );

        // Update last login and token
        admin.lastLogin = new Date();
        admin.token = token;
        await admin.save();

        Helper.response("Success", "Admin login successful", {
            adminId: admin._id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            permissions: admin.permissions,
            token: token,
            base_url: process.env.BASE_URL
        }, res, 200);

    } catch (error) {
        console.error('Admin login error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Admin logout
AdminController.adminLogout = async (req, res) => {
    try {
        const token = req.headers["authorization"];

        if (!token) {
            return Helper.response("Failed", "Authorization token is required", {}, res, 400);
        }

        const tokenParts = token.split(" ");
        if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
            return Helper.response("Failed", "Invalid token format", {}, res, 400);
        }

        const tokenString = tokenParts[1];

        // Find admin by token and clear it
        const admin = await Admin.findOne({ token: tokenString });

        if (admin) {
            admin.token = '';
            await admin.save();
            Helper.response("Success", "Admin logout successful", {}, res, 200);
        } else {
            Helper.response("Failed", "Invalid token", {}, res, 401);
        }

    } catch (error) {
        console.error('Admin logout error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get pending driver license verifications
AdminController.getPendingVerifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const pendingLicenses = await DriverLicense.find({ verificationStatus: 'pending' })
            .populate('userId', 'mobile email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await DriverLicense.countDocuments({ verificationStatus: 'pending' });

        Helper.response("Success", "Pending verifications retrieved successfully", {
            pendingLicenses,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get pending verifications error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Verify driver license
AdminController.verifyDriverLicense = async (req, res) => {
    try {
        const { licenseId, status, rejectionReason } = req.body;
        const adminId = req.admin.id; // Get admin ID from middleware

        if (!licenseId || !status) {
            return Helper.response("Failed", "Missing required fields (licenseId, status)", {}, res, 400);
        }

        const license = await DriverLicense.findById(licenseId);
        if (!license) {
            return Helper.response("Failed", "License not found", {}, res, 404);
        }

        // Update verification status
        license.verificationStatus = status;
        license.verifiedBy = adminId;
        license.verifiedAt = new Date();

        if (status === 'rejected' && rejectionReason) {
            license.rejectionReason = rejectionReason;
        }

        await license.save();

        // Create notification for user
        const notification = new Notification({
            userId: license.userId,
            title: "License Verification Update",
            message: `Your driver's license verification has been ${status}`,
            type: "general",
            relatedId: licenseId,
            relatedType: "user"
        });
        await notification.save();

        Helper.response("Success", `License ${status} successfully`, { license }, res, 200);

    } catch (error) {
        console.error('Verify driver license error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get RTO assistance requests
AdminController.getRTOAssistanceRequests = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // This would typically come from a separate RTO assistance model
        // For now, we'll get vehicle registrations that need RTO assistance
        const Register = require('../Models/RegisterModel');
        const rtoRequests = await Register.find({ rtoAssistanceRequested: true })
            .populate('userId', 'mobile email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Register.countDocuments({ rtoAssistanceRequested: true });

        Helper.response("Success", "RTO assistance requests retrieved successfully", {
            rtoRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get RTO assistance requests error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Update RTO assistance status
AdminController.updateRTOAssistanceStatus = async (req, res) => {
    try {
        const { vehicleId, status, notes } = req.body;
        const adminId = req.admin.id; // Get admin ID from middleware

        if (!vehicleId || !status) {
            return Helper.response("Failed", "Missing required fields (vehicleId, status)", {}, res, 400);
        }

        const Register = require('../Models/RegisterModel');
        const vehicle = await Register.findById(vehicleId);
        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // Update RTO assistance status
        vehicle.rtoAssistanceStatus = status;
        vehicle.rtoAssistanceNotes = notes || '';
        vehicle.rtoAssistanceUpdatedBy = adminId;
        vehicle.rtoAssistanceUpdatedAt = new Date();

        await vehicle.save();

        // Create notification for owner
        const notification = new Notification({
            userId: vehicle._id, // Assuming owner has a user account
            title: "RTO Assistance Update",
            message: `Your RTO assistance request status has been updated to: ${status}`,
            type: "rto_assistance",
            relatedId: vehicleId,
            relatedType: "vehicle"
        });
        await notification.save();

        Helper.response("Success", "RTO assistance status updated successfully", { vehicle }, res, 200);

    } catch (error) {
        console.error('Update RTO assistance status error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get dashboard statistics
AdminController.getDashboardStats = async (req, res) => {
    try {
        const userModel = require('../Models/userModel');
        const Register = require('../Models/RegisterModel');
        const RegisterRental = require('../Models/RegisterRentalModel');
        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const Earnings = require('../Models/EarningsModel');

        // Basic counts
        const totalUsers = await userModel.countDocuments();
        const totalVehicles = await Register.countDocuments();
        const totalRentalBusinesses = await RegisterRental.countDocuments();
        const totalRegisteredVehicles = await RegisteredVehicles.countDocuments();
        const totalBookings = await Booking.countDocuments();
        const pendingVerifications = await RegisteredVehicles.countDocuments({ verificationStatus: 'pending' });

        // Booking status counts
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });
        const activeBookings = await Booking.countDocuments({ status: { $in: ['accepted', 'in_progress'] } });
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

        // Revenue calculations
        const earningsData = await Earnings.aggregate([
            {
                $match: { paymentStatus: 'paid' }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' }
                }
            }
        ]);

        const revenueStats = earningsData.length > 0 ? earningsData[0] : {
            totalRevenue: 0,
            totalPlatformFee: 0,
            totalNetAmount: 0
        };

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentUsers = await userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const recentVehicles = await Register.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const recentBookings = await Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

        // Vehicle type distribution
        const vehicleTypeStats = await Register.aggregate([
            {
                $group: {
                    _id: '$vehicleType',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Booking status distribution
        const bookingStatusStats = await Booking.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const stats = {
            overview: {
                totalUsers,
                totalVehicles: totalVehicles + totalRegisteredVehicles,
                totalRentalBusinesses,
                totalBookings,
                pendingVerifications
            },
            bookings: {
                total: totalBookings,
                pending: pendingBookings,
                active: activeBookings,
                completed: completedBookings,
                cancelled: cancelledBookings
            },
            revenue: {
                totalRevenue: revenueStats.totalRevenue || 0,
                totalPlatformFee: revenueStats.totalPlatformFee || 0,
                totalNetAmount: revenueStats.totalNetAmount || 0
            },
            recentActivity: {
                newUsers: recentUsers,
                newVehicles: recentVehicles,
                newBookings: recentBookings
            },
            distributions: {
                vehicleTypes: vehicleTypeStats,
                bookingStatuses: bookingStatusStats
            }
        };

        Helper.response("Success", "Dashboard statistics retrieved successfully", stats, res, 200);

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get all bookings for admin
AdminController.getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (status) {
            query.status = status;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const bookings = await Booking.find(query)
            .populate('renterId', 'mobile email username')
            .populate('ownerId', 'Name ContactNo')
            .populate('vehicleId', 'VehicleModel vehicleType category subcategory')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Booking.countDocuments(query);

        Helper.response("Success", "All bookings retrieved successfully", {
            bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get all bookings error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get all users for admin
AdminController.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, userType, search } = req.query;
        const skip = (page - 1) * limit;
        const userModel = require('../Models/userModel');

        let query = {};
        if (userType) {
            query.userType = userType;
        }
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await userModel.find(query)
            .select('-password -token')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await userModel.countDocuments(query);

        Helper.response("Success", "All users retrieved successfully", {
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get all users error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get all vehicles for admin
AdminController.getAllVehicles = async (req, res) => {
    try {
        const { page = 1, limit = 20, vehicleType, category, status, verificationStatus } = req.query;
        const skip = (page - 1) * limit;
        const RegisteredVehicles = require('../Models/RegisteredVehicles');

        let query = {};
        if (vehicleType) query.vehicleType = vehicleType;
        if (category) query.category = category;
        if (verificationStatus) query.verificationStatus = verificationStatus;

        // Get all vehicles from RegisteredVehicles (primary model)
        // Populate registerId for personal details and rentalId for rental business details
        const vehicles = await RegisteredVehicles.find(query)
            .populate('userId', 'username email mobile')
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
            .populate('rentalId', 'businessName ownerName City State Address ContactNo')
            .populate('verifiedBy', 'username fullName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await RegisteredVehicles.countDocuments(query);

        Helper.response("Success", "All vehicles retrieved successfully", {
            vehicles,
            registeredVehicles: [], // Keep for backward compatibility but empty
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('Get all vehicles error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get pending vehicle verifications
AdminController.getPendingVehicleVerifications = async (req, res) => {
    try {

        const { page = 1, limit = 20, vehicleType } = req.query;
        const skip = (page - 1) * limit;
        const RegisteredVehicles = require('../Models/RegisteredVehicles');

        let query = { verificationStatus: 'pending' };
        if (vehicleType) query.vehicleType = vehicleType;

        // Get all pending vehicles from RegisteredVehicles (primary model)
        // Populate registerId for personal details and rentalId for rental business details
        const pendingVehicles = await RegisteredVehicles.find(query)
            .populate('userId', 'username email mobile')
            .populate('registerId', 'Name Age Address Landmark Pincode City State ContactNo latitude longitude')
            .populate('rentalId', 'businessName ownerName City State Address ContactNo')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalPending = await RegisteredVehicles.countDocuments(query);

        Helper.response("Success", "Pending vehicle verifications retrieved successfully", {
            vehicles: pendingVehicles,
            registeredVehicles: [], // Keep for backward compatibility but empty
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalPending / limit),
                totalCount: totalPending
            }
        }, res, 200);

    } catch (error) {
        console.error('Get pending vehicle verifications error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Verify vehicle (Register model)
AdminController.verifyVehicle = async (req, res) => {
    try {
        const { vehicleId, status, rejectionReason, vehicleType } = req.body;
        const adminId = req.admin ? req.admin.id : null; // Get admin ID from middleware

        if (!vehicleId || !status) {
            return Helper.response("Failed", "Missing required fields (vehicleId, status)", {}, res, 400);
        }

        if (!['verified', 'rejected'].includes(status)) {
            return Helper.response("Failed", "Invalid status. Must be 'verified' or 'rejected'", {}, res, 400);
        }

        const Register = require('../Models/RegisterModel');
        const RegisteredVehicles = require('../Models/RegisteredVehicles');
        const Notification = require('../Models/NotificationModel');

        let vehicle = null;
        let isRegisteredVehicle = false;

        // Try to find in Register model first
        vehicle = await Register.findById(vehicleId);

        // If not found, try RegisteredVehicles model
        if (!vehicle) {
            vehicle = await RegisteredVehicles.findById(vehicleId);
            isRegisteredVehicle = true;
        }

        if (!vehicle) {
            return Helper.response("Failed", "Vehicle not found", {}, res, 404);
        }

        // For RegisteredVehicles, ensure required fields are present before saving
        if (isRegisteredVehicle) {
            // Ensure ReturnDuration exists (required field)
            // This handles cases where vehicles were created before ReturnDuration was required
            if (!vehicle.ReturnDuration || (typeof vehicle.ReturnDuration === 'string' && vehicle.ReturnDuration.trim() === '')) {
                vehicle.ReturnDuration = 'Not specified';
            }
        }

        // Update verification status
        vehicle.verificationStatus = status;
        vehicle.verifiedBy = adminId;
        vehicle.verifiedAt = new Date();

        if (status === 'rejected' && rejectionReason) {
            vehicle.rejectionReason = rejectionReason;
        } else if (status === 'verified') {
            vehicle.rejectionReason = '';
        }

        await vehicle.save();

        // Create notification for user
        if (vehicle.userId) {
            const notification = new Notification({
                userId: vehicle.userId,
                title: "Vehicle Verification Update",
                message: `Your vehicle ${vehicle.VehicleModel || vehicle.vehicleModel} verification has been ${status}${status === 'rejected' && rejectionReason ? ': ' + rejectionReason : ''}`,
                type: "vehicle_verification",
                relatedId: vehicleId,
                relatedType: "vehicle"
            });
            await notification.save();
        }

        Helper.response("Success", `Vehicle ${status} successfully`, {
            vehicle,
            vehicleType: isRegisteredVehicle ? 'registered' : 'standard'
        }, res, 200);

    } catch (error) {
        console.error('Verify vehicle error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get recent activities
AdminController.getRecentActivities = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const userModel = require('../Models/userModel');
        const Register = require('../Models/RegisterModel');

        // Get recent users
        const recentUsers = await userModel.find()
            .select('username email mobile createdAt userType')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        // Get recent vehicles
        const recentVehicles = await Register.find()
            .select('Name VehicleModel vehicleType category createdAt')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        // Get recent bookings
        const recentBookings = await Booking.find()
            .populate('renterId', 'username email')
            .populate('vehicleId', 'VehicleModel vehicleType')
            .select('status totalAmount startDate endDate createdAt')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        Helper.response("Success", "Recent activities retrieved successfully", {
            recentUsers,
            recentVehicles,
            recentBookings
        }, res, 200);

    } catch (error) {
        console.error('Get recent activities error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get revenue analytics
AdminController.getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query; // day, week, month, year
        const Earnings = require('../Models/EarningsModel');

        let startDate = new Date();
        let groupFormat = '%Y-%m-%d';

        switch (period) {
            case 'day':
                startDate.setDate(startDate.getDate() - 30);
                groupFormat = '%Y-%m-%d';
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 84); // 12 weeks
                groupFormat = '%Y-%m';
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 12);
                groupFormat = '%Y-%m';
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 5);
                groupFormat = '%Y';
                break;
        }

        const revenueData = await Earnings.aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    paymentDate: { $gte: startDate, $ne: null }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: '$paymentDate'
                        }
                    },
                    totalRevenue: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        Helper.response("Success", "Revenue analytics retrieved successfully", {
            period,
            revenueData
        }, res, 200);

    } catch (error) {
        console.error('Get revenue analytics error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

// Get earnings analytics by owner
AdminController.getOwnersRevenueAnalytics = async (req, res) => {
    try {
        const { limit = 100, sortBy = 'totalRevenue', order = 'desc' } = req.query;
        const Earnings = require('../Models/EarningsModel');

        const sortStage = {};
        sortStage[sortBy] = order === 'desc' ? -1 : 1;

        const ownerAnalytics = await Earnings.aggregate([
            {
                $match: { paymentStatus: 'paid' }
            },
            {
                $group: {
                    _id: '$ownerId',
                    totalRevenue: { $sum: '$grossAmount' },
                    totalPlatformFee: { $sum: '$platformFee' },
                    totalNetAmount: { $sum: '$netAmount' },
                    totalTrips: { $sum: 1 },
                    lastEarningDate: { $max: '$paymentDate' }
                }
            },
            {
                $lookup: {
                    from: 'registers', // Assuming Register collection name
                    localField: '_id',
                    foreignField: '_id',
                    as: 'ownerDetails'
                }
            },
            {
                $unwind: {
                    path: '$ownerDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    ownerName: { $ifNull: ['$ownerDetails.Name', 'Unknown'] },
                    ownerEmail: { $ifNull: ['$ownerDetails.email', 'N/A'] }, // Check if email is in Register
                    ownerContact: { $ifNull: ['$ownerDetails.ContactNo', 'N/A'] },
                    totalRevenue: 1,
                    totalPlatformFee: 1,
                    totalNetAmount: 1,
                    totalTrips: 1,
                    lastEarningDate: 1
                }
            },
            {
                $sort: sortStage
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        Helper.response("Success", "Owners revenue analytics retrieved successfully", {
            ownerAnalytics
        }, res, 200);

    } catch (error) {
        console.error('Get owners revenue analytics error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = AdminController;

// Get admin profile
AdminController.getAdminProfile = async (req, res) => {
    try {
        const adminId = req.admin.id;
        const admin = await Admin.findById(adminId).select('-password -token');

        if (!admin) {
            return Helper.response("Failed", "Admin not found", {}, res, 404);
        }

        Helper.response("Success", "Admin profile retrieved successfully", admin, res, 200);

    } catch (error) {
        console.error('Get admin profile error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = AdminController;
