const cron = require("node-cron");
const nodemailer = require("nodemailer");
const User = require("../Models/user-model");
const dayjs = require("dayjs");

// Setup your email transporter (use your SMTP credentials or service like Gmail)
const transporter = nodemailer.createTransport({
  service: "Gmail", // or "hotmail", etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use app password if using Gmail 2FA
  },
});

const sendExpiryReminderEmails = async () => {
  try {
    const targetDate = dayjs().add(2, "day").startOf("day").toDate();
    const nextDay = dayjs().add(2, "day").endOf("day").toDate();

    const users = await User.find({
      role: "user",
      membershipExpiryDate: { $gte: targetDate, $lte: nextDay },
    });

    for (const user of users) {
      const mailOptions = {
        from: `"Strength Zone" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Membership Expiry Reminder",
        html: `
    <div style="font-family: Arial, sans-serif; color: #000; background: #fff; padding: 20px; border: 1px solid #000;">
      <h2 style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px;">Membership Expiry Notice</h2>
      <p>Dear <strong>${user.username}</strong>,</p>
      <p>This is a friendly reminder that your gym membership will expire on <strong>${dayjs(
        user.membershipExpiryDate
      ).format("DD MMM YYYY")}</strong>.</p>

      <p>Please renew your membership in time to continue enjoying our facilities without interruption.</p>

      <div style="margin: 20px 0; padding: 10px; border: 1px dashed #000;">
        <p style="margin: 0;"><strong>Expiry Date:</strong> ${dayjs(
          user.membershipExpiryDate
        ).format("DD MMM YYYY")}</p>
      
      </div>

      <p>If you have already renewed, please ignore this message.</p>

      <p style="margin-top: 30px;">Thank you,<br><strong>Your Gym Team</strong></p>
    </div>
  `,
      };

      await transporter.sendMail(mailOptions);
    }
  } catch (error) {
    console.error("Error sending expiry reminders:", error);
  }
};

// Run daily at 8 AM
const setupMembershipReminderJob = () => {
  cron
    .schedule("0 8 * * *", () => {
      sendExpiryReminderEmails();
    })
    .start();
};

module.exports = { setupMembershipReminderJob };
