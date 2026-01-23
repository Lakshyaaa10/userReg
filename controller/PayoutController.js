const Helper = require('../Helper/Helper');
const User = require('../Models/userModel');
const Booking = require('../Models/BookingModel');
const Earnings = require('../Models/EarningsModel');

const PayoutController = {};

// -------------------------------------------------------------------------
// MANUAL PAYOUTS (Admin Managed)
// -------------------------------------------------------------------------

/**
 * Get all pending payouts for Admin to review
 * GET /payouts/pending
 */
PayoutController.getPendingPayouts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const query = {
            paymentStatus: { $ne: 'paid' }, // Not paid yet
            // You might want to filter by booking status 'completed' to only show earned money
            // valid earnings are usually created only when booking is completed, 
            // but let's double check via population or field if needed. 
            // For now, assuming Earnings record existence implies entitlement.
        };

        const pendingPayouts = await Earnings.find(query)
            .populate('ownerId', 'fullName email mobile payoutMethod') // Get owner bank details
            .populate('bookingId', 'vehicleModel totalAmount completedAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Earnings.countDocuments(query);

        Helper.response("Success", "Pending payouts retrieved successfully", {
            payouts: pendingPayouts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        }, res, 200);

    } catch (error) {
        console.error('[Payout] Get Pending Error:', error);
        Helper.response("Failed", "Error fetching pending payouts", error.message, res, 500);
    }
};

/**
 * Mark a payout as PAID manually (after Admin transfers money)
 * POST /payouts/mark-paid
 */
PayoutController.markPayoutAsPaid = async (req, res) => {
    try {
        const { earningsId, transactionReference, notes } = req.body;

        if (!earningsId) {
            return Helper.response("Failed", "earningsId is required", {}, res, 400);
        }

        const earnings = await Earnings.findById(earningsId);
        if (!earnings) {
            return Helper.response("Failed", "Earnings record not found", {}, res, 404);
        }

        if (earnings.paymentStatus === 'paid') {
            return Helper.response("Failed", "This payout is already marked as paid", {}, res, 400);
        }

        // Update status
        earnings.paymentStatus = 'paid';
        earnings.paymentMethod = 'manual_transfer'; // or 'bank_transfer'
        earnings.paymentId = transactionReference || `manual_${Date.now()}`; // Store ref no
        earnings.paymentDate = new Date();

        // Save notes if any (maybe add a notes field to schema later, for now just log it or ignore)
        // console.log('Admin Notes:', notes);

        await earnings.save();

        Helper.response("Success", "Payout marked as paid successfully", { earnings }, res, 200);

    } catch (error) {
        console.error('[Payout] Mark Paid Error:', error);
        Helper.response("Failed", "Error updating payout status", error.message, res, 500);
    }
};

// -------------------------------------------------------------------------
// LEGACY / RAZORPAYX (Disabled/Placeholder)
// -------------------------------------------------------------------------

// Add or Update Payout Method (Bank Details) - Keep this so owners can still save details
PayoutController.addPayoutMethod = async (req, res) => {
    try {
        const { userId, type, accountDetails } = req.body;

        if (!userId || !type || !accountDetails) {
            return Helper.response("Failed", "Missing required fields", {}, res, 400);
        }

        const user = await User.findById(userId);
        if (!user) {
            return Helper.response("Failed", "User not found", {}, res, 404);
        }

        // Just save to DB, no RazorpayX call for now
        user.payoutMethod = {
            type: type,
            ...accountDetails
        };

        await user.save();

        Helper.response("Success", "Payout method saved successfully", {
            payoutMethod: user.payoutMethod
        }, res, 200);

    } catch (error) {
        console.error('[Payout] Add Method Error:', error);
        Helper.response("Failed", "Error adding payout method", error.message, res, 500);
    }
};

// Placeholder for processPayoutForBooking if called by accident
PayoutController.processPayoutForBooking = async (bookingId) => {
    console.log(`[Payout] Manual Mode: Auto-payout skipped for booking ${bookingId}`);
    return;
};

// Placeholder for webhook
PayoutController.handleWebhook = async (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Manual mode enabled' });
};

module.exports = PayoutController;
