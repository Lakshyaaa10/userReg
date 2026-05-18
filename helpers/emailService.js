const nodemailer = require("nodemailer");

/**
 * Creates a Nodemailer transporter using Titan Mail SMTP configuration.
 */
const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.titan.email",
  port: smtpPort,
  secure:
    process.env.SMTP_SECURE === "true" ||
    (!process.env.SMTP_SECURE && smtpPort === 465),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/**
 * Sends an email using the configured transporter.
 * 
 * @param {Object} mailOptions 
 * @param {string} mailOptions.to - Recipient email address
 * @param {string} mailOptions.subject - Email subject
 * @param {string} [mailOptions.text] - Plain text body
 * @param {string} [mailOptions.html] - HTML body
 * @returns {Promise<Object>} Information about the sent email
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!isEmailConfigured()) {
      throw new Error("SMTP config missing");
    }

    const mailOptions = {
      from: process.env.SMTP_USER, // Sender address
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendEmail,
  isEmailConfigured,
};
