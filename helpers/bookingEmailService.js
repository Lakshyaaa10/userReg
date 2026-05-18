const { sendEmail } = require("./emailService");
const { renderTemplate } = require("./emailTemplateService");
const userModel = require("../Models/userModel");

function formatCurrency(amount) {
  const value = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function resolveEmailRecipients(booking) {
  const [renter, owner] = await Promise.all([
    booking.renterId ? userModel.findById(booking.renterId).select("email fullName username") : null,
    booking.ownerId ? userModel.findById(booking.ownerId).select("email fullName username") : null,
  ]);

  return {
    renterEmail: booking.renterEmail && booking.renterEmail !== "N/A" ? booking.renterEmail : renter?.email,
    ownerEmail: owner?.email,
    renterName:
      booking.renterName || renter?.fullName || renter?.username || "Customer",
    ownerName:
      booking.ownerName || owner?.fullName || owner?.username || "Owner",
  };
}

function buildBookingView(booking) {
  return {
    bookingId: booking._id?.toString(),
    vehicleModel: booking.vehicleModel,
    vehicleType: booking.vehicleType,
    startDate: formatDate(booking.startDate),
    endDate: formatDate(booking.endDate),
    totalDays: booking.totalDays,
    pickupLocation: booking.pickupLocation || "To be confirmed",
    dropoffLocation: booking.dropoffLocation || "To be confirmed",
    renterName: booking.renterName,
    renterPhone: booking.renterPhone,
    renterEmail: booking.renterEmail,
    ownerName: booking.ownerName,
    ownerPhone: booking.ownerPhone,
    totalAmount: formatCurrency(booking.totalAmount),
    finalAmount: formatCurrency(
      booking.finalAmount !== null && booking.finalAmount !== undefined
        ? booking.finalAmount
        : booking.totalAmount
    ),
    discountAmount: formatCurrency(booking.discountAmount || 0),
    couponCode: booking.couponCode || "Not applied",
    paymentStatus: booking.paymentStatus || "pending",
    bookingStatus: booking.status || "pending",
    paymentMethod: booking.paymentMethod || "Pending",
    createdAt: formatDateTime(booking.createdAt),
    specialRequests: booking.specialRequests || "None",
    cancellationReason: booking.cancellationReason || "N/A",
  };
}

async function sendBookingLifecycleEmails({
  booking,
  eventKey,
  extraMessage,
}) {
  const recipients = await resolveEmailRecipients(booking);
  const bookingView = buildBookingView(booking);

  const eventMap = {
    request_created: {
      renter: {
        subject: `Booking request received • ${booking.vehicleModel}`,
        heading: "Booking request received",
        intro:
          extraMessage ||
          "We received your booking request. Owner has full details now.",
      },
      owner: {
        subject: `New booking request • ${booking.vehicleModel}`,
        heading: "New booking request",
        intro:
          extraMessage ||
          "A renter requested your vehicle. Review trip details below.",
      },
    },
    payment_confirmed: {
      renter: {
        subject: `Payment confirmed • ${booking.vehicleModel}`,
        heading: "Payment confirmed",
        intro:
          extraMessage ||
          "Payment cleared. Your booking is now secured in system.",
      },
      owner: {
        subject: `Booking paid • ${booking.vehicleModel}`,
        heading: "Booking paid",
        intro:
          extraMessage ||
          "Renter payment completed. Booking is ready for next step.",
      },
    },
    status_updated: {
      renter: {
        subject: `Booking ${booking.status} • ${booking.vehicleModel}`,
        heading: `Booking ${booking.status}`,
        intro:
          extraMessage ||
          `Your booking status changed to ${booking.status}.`,
      },
      owner: {
        subject: `Booking ${booking.status} • ${booking.vehicleModel}`,
        heading: `Booking ${booking.status}`,
        intro:
          extraMessage ||
          `Booking status changed to ${booking.status}.`,
      },
    },
    cancelled: {
      renter: {
        subject: `Booking cancelled • ${booking.vehicleModel}`,
        heading: "Booking cancelled",
        intro:
          extraMessage ||
          "This booking was cancelled. Details kept below for reference.",
      },
      owner: {
        subject: `Booking cancelled • ${booking.vehicleModel}`,
        heading: "Booking cancelled",
        intro:
          extraMessage ||
          "This booking was cancelled. Vehicle dates may now reopen.",
      },
    },
  };

  const event = eventMap[eventKey];
  if (!event) return;

  const jobs = [];

  if (recipients.renterEmail) {
    jobs.push(
      sendEmail({
        to: recipients.renterEmail,
        subject: event.renter.subject,
        html: renderTemplate("booking-summary.pug", {
          previewText: event.renter.subject,
          recipientName: recipients.renterName,
          heading: event.renter.heading,
          intro: event.renter.intro,
          booking: bookingView,
          audience: "renter",
        }),
      })
    );
  }

  if (recipients.ownerEmail) {
    jobs.push(
      sendEmail({
        to: recipients.ownerEmail,
        subject: event.owner.subject,
        html: renderTemplate("booking-summary.pug", {
          previewText: event.owner.subject,
          recipientName: recipients.ownerName,
          heading: event.owner.heading,
          intro: event.owner.intro,
          booking: bookingView,
          audience: "owner",
        }),
      })
    );
  }

  await Promise.all(jobs);
}

module.exports = {
  sendBookingLifecycleEmails,
};
