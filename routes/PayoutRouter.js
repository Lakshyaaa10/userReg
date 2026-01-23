const express = require('express');
const router = express.Router();
const PayoutController = require('../controller/PayoutController');

// Add Payout Method (Bank Account / UPI)
// POST /payouts/method
router.post('/method', PayoutController.addPayoutMethod);

// -----------------------------------------------------------------
// ADMIN APIs for Manual Payouts
// -----------------------------------------------------------------

// Get Pending Payouts
// GET /payouts/pending
router.get('/pending', PayoutController.getPendingPayouts);

// Mark Payout as Paid
// POST /payouts/mark-paid
router.post('/mark-paid', PayoutController.markPayoutAsPaid);

// Webhook (Placeholder/Disabled)
router.post('/webhook', PayoutController.handleWebhook);

module.exports = router;
