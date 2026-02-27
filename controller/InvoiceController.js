const Helper = require('../Helper/Helper');
const Booking = require('../Models/BookingModel');

const InvoiceController = {};

// ============================================
// Generate HTML Invoice for a booking
// ============================================
InvoiceController.generateInvoice = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return Helper.response("Failed", "Missing bookingId", {}, res, 400);
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return Helper.response("Failed", "Booking not found", {}, res, 404);
        }

        // Only generate invoice for paid/completed bookings
        if (!['paid', 'completed'].includes(booking.paymentStatus) && !['completed', 'confirmed', 'accepted', 'in_progress'].includes(booking.status)) {
            return Helper.response("Failed", "Invoice can only be generated for confirmed/completed bookings", {}, res, 400);
        }

        const invoiceNumber = `ZG-INV-${booking._id.toString().slice(-8).toUpperCase()}`;
        const invoiceDate = new Date().toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const startDate = new Date(booking.startDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const endDate = new Date(booking.endDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        const baseAmount = booking.totalAmount;
        const discount = booking.discountAmount || 0;
        const finalAmount = booking.finalAmount || (baseAmount - discount);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber} | Zugo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #1a1a1a;
            padding: 40px 20px;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .header {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            color: white;
            padding: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .logo {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
        }
        .logo span { color: #4f9cf7; }
        .invoice-meta {
            text-align: right;
            font-size: 14px;
            color: #a0a0b0;
        }
        .invoice-meta .inv-number {
            font-size: 18px;
            font-weight: 700;
            color: white;
            margin-bottom: 4px;
        }
        .body { padding: 40px; }
        .section { margin-bottom: 32px; }
        .section-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #999;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .info-item label {
            display: block;
            font-size: 11px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .info-item p {
            font-size: 15px;
            font-weight: 600;
            color: #1a1a1a;
        }
        .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .vehicle-icon {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #000 0%, #333 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
        }
        .vehicle-details h3 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        .vehicle-details p {
            font-size: 13px;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table th {
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #999;
            padding: 12px 0;
            border-bottom: 2px solid #f0f0f0;
        }
        table th:last-child { text-align: right; }
        table td {
            padding: 14px 0;
            font-size: 15px;
            border-bottom: 1px solid #f5f5f5;
        }
        table td:last-child {
            text-align: right;
            font-weight: 600;
        }
        .totals-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 15px;
        }
        .total-row.discount { color: #22c55e; }
        .total-row.final {
            font-size: 20px;
            font-weight: 800;
            border-top: 2px solid #e0e0e0;
            margin-top: 8px;
            padding-top: 16px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .status-paid { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef9c3; color: #854d0e; }
        .footer {
            background: #f8f9fa;
            padding: 24px 40px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
        }
        .footer a { color: #4f9cf7; text-decoration: none; }
        .print-btn {
            display: block;
            width: 200px;
            margin: 20px auto;
            padding: 12px;
            background: #0a0a0a;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
        }
        .print-btn:hover { background: #333; }
        @media print {
            body { padding: 0; background: white; }
            .invoice-container { box-shadow: none; }
            .print-btn { display: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                <div class="logo">Zu<span>go</span></div>
                <p style="font-size: 13px; color: #a0a0b0; margin-top: 4px;">Vehicle Rental Platform</p>
            </div>
            <div class="invoice-meta">
                <div class="inv-number">${invoiceNumber}</div>
                <div>Date: ${invoiceDate}</div>
            </div>
        </div>

        <div class="body">
            <!-- Renter & Owner Info -->
            <div class="section">
                <div class="section-title">Booking Details</div>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Renter</label>
                        <p>${booking.renterName || 'N/A'}</p>
                    </div>
                    <div class="info-item">
                        <label>Owner</label>
                        <p>${booking.ownerName || 'N/A'}</p>
                    </div>
                    <div class="info-item">
                        <label>Renter Contact</label>
                        <p>${booking.renterPhone || booking.renterEmail || 'N/A'}</p>
                    </div>
                    <div class="info-item">
                        <label>Owner Contact</label>
                        <p>${booking.ownerPhone || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <!-- Vehicle -->
            <div class="section">
                <div class="section-title">Vehicle</div>
                <div class="vehicle-card">
                    <div class="vehicle-icon">🏍️</div>
                    <div class="vehicle-details">
                        <h3>${booking.vehicleModel || 'Vehicle'}</h3>
                        <p>${booking.vehicleType || ''}</p>
                    </div>
                </div>
            </div>

            <!-- Trip Details -->
            <div class="section">
                <div class="section-title">Trip Details</div>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Start Date</label>
                        <p>${startDate}</p>
                    </div>
                    <div class="info-item">
                        <label>End Date</label>
                        <p>${endDate}</p>
                    </div>
                    <div class="info-item">
                        <label>Duration</label>
                        <p>${booking.totalDays} day(s)</p>
                    </div>
                    <div class="info-item">
                        <label>Pickup Location</label>
                        <p>${booking.pickupLocation || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <!-- Price Breakdown -->
            <div class="section">
                <div class="section-title">Price Breakdown</div>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Base Rental (${booking.totalDays} days × ₹${booking.pricePerDay}/day)</td>
                            <td>₹${baseAmount.toLocaleString('en-IN')}</td>
                        </tr>
                        ${booking.extensionCount > 0 ? `
                        <tr>
                            <td>Extensions (${booking.extensionCount} time(s))</td>
                            <td>Included above</td>
                        </tr>` : ''}
                    </tbody>
                </table>

                <div class="totals-section">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>₹${baseAmount.toLocaleString('en-IN')}</span>
                    </div>
                    ${discount > 0 ? `
                    <div class="total-row discount">
                        <span>Discount ${booking.couponCode ? '(' + booking.couponCode + ')' : ''}</span>
                        <span>- ₹${discount.toLocaleString('en-IN')}</span>
                    </div>` : ''}
                    <div class="total-row final">
                        <span>Total Payable</span>
                        <span>₹${finalAmount.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>

            <!-- Payment Info -->
            <div class="section">
                <div class="section-title">Payment Information</div>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Payment Status</label>
                        <p>
                            <span class="status-badge ${booking.paymentStatus === 'paid' ? 'status-paid' : 'status-pending'}">
                                ${booking.paymentStatus || 'pending'}
                            </span>
                        </p>
                    </div>
                    <div class="info-item">
                        <label>Payment Method</label>
                        <p>${booking.paymentMethod || 'Online'}</p>
                    </div>
                    ${booking.paymentId ? `
                    <div class="info-item">
                        <label>Transaction ID</label>
                        <p>${booking.paymentId}</p>
                    </div>` : ''}
                    <div class="info-item">
                        <label>Booking Status</label>
                        <p style="text-transform: capitalize;">${booking.status}</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>This is a computer-generated invoice and does not require a signature.</p>
            <p style="margin-top: 8px;">
                Zugo Vehicle Rental Platform | <a href="https://zugo.co.in">zugo.co.in</a> | support@zugo.co.in
            </p>
        </div>
    </div>

    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
</body>
</html>`;

        // Send as HTML
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        console.error('Generate invoice error:', error);
        Helper.response("Failed", "Internal Server Error", error.message, res, 500);
    }
};

module.exports = InvoiceController;
