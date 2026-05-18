const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { sendEmail } = require('./helpers/emailService');

async function testMail() {
  try {
    console.log("Testing email configuration...");
    const info = await sendEmail({
      to: 'lakshyak6@gmail.com', // sending it to yourself to test
      subject: "Test Email from Zugo Backend",
      text: "If you are reading this, your SMTP configuration is working perfectly!",
      html: "<b>If you are reading this, your SMTP configuration is working perfectly!</b>",
    });
    console.log("✅ Success! Email sent.");
  } catch (error) {
    console.error("❌ Failed to send email.");
    console.error(error);
  }
}

testMail();
