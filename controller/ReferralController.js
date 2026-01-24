const Helper = require('../Helper/Helper');
const User = require('../Models/userModel');

const ReferralController = {};

// Get referral stats for the logged-in user
ReferralController.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId)
            .select('referralCode walletPoints referralHistory')
            .populate('referralHistory.userId', 'username -_id'); // Populate username of referred users

        if (!user) {
            return Helper.response("Failed", "User not found", {}, res, 404);
        }

        // If referral code is missing (old user), generate one
        if (!user.referralCode) {
            const username = user.username || 'USER';
            const baseName = username.substring(0, 4).toUpperCase();
            user.referralCode = baseName + Math.random().toString(36).substr(2, 4).toUpperCase();
            await user.save();
        }

        Helper.response("Success", "Referral stats retrieved successfully", {
            referralCode: user.referralCode,
            walletPoints: user.walletPoints || 0,
            referralHistory: user.referralHistory || []
        }, res, 200);

    } catch (error) {
        console.error('Get referral stats error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = ReferralController;
