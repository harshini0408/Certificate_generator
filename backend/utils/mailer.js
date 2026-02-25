const nodemailer = require("nodemailer");
const path = require("path");

/**
 * Send certificate via email using Gmail SMTP.
 *
 * Setup:
 *  1. Go to Google Account > Security > 2-Step Verification (enable it)
 *  2. Go to Google Account > Security > App Passwords
 *  3. Generate an app password for "Mail"
 *  4. Put your email in EMAIL_USER and the app password in EMAIL_PASS in .env
 */
async function sendEmail(recipientEmail, recipientName, certificatePath) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "Email credentials not configured. Set EMAIL_USER and EMAIL_PASS in .env"
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const filename = path.basename(certificatePath);

  const mailOptions = {
    from: `"Yukta Certificates" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `🎉 Your Certificate - Yukta Event`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50;">Congratulations, ${recipientName}! 🎉</h2>
        <p style="color: #555; font-size: 16px;">
          Thank you for your participation! Please find your certificate attached to this email.
        </p>
        <p style="color: #555; font-size: 14px;">
          We hope you enjoyed the event and look forward to seeing you again!
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated email from Yukta Certificate Generator.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `Certificate_${recipientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        path: certificatePath,
        contentType: "application/pdf",
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`  ✓ Email sent to ${recipientEmail} (${info.messageId})`);
  return info;
}

module.exports = { sendEmail };
