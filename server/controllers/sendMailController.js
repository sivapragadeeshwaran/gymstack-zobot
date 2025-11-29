const User = require("../Models/user-model");
const nodemailer = require("nodemailer");

// ✅ Log environment variables status
console.log("📧 [EMAIL CONFIG] Checking SendGrid configuration...");
console.log("   EMAIL_USER:", process.env.EMAIL_USER);
console.log("   EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
console.log(
  "   EMAIL_PASS starts with SG.:",
  process.env.EMAIL_PASS?.startsWith("SG.")
);
console.log("   EMAIL_FROM:", process.env.EMAIL_FROM || "noreply@gym.com");

// ✅ SENDGRID PRODUCTION-OPTIMIZED TRANSPORTER
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: "apikey", // This must be exactly "apikey"
    pass: process.env.EMAIL_PASS, // Your SendGrid API key
  },
  // ✅ OPTIMIZED FOR SPEED
  pool: true, // Connection pooling
  maxConnections: 5, // Max 5 concurrent
  maxMessages: 100, // 100 messages per connection
  rateDelta: 1000, // 1 second window
  rateLimit: 5, // 5 emails per second
  connectionTimeout: 5000, // 5 second timeout
  greetingTimeout: 5000,
  socketTimeout: 5000,
  // ✅ TLS settings
  tls: {
    rejectUnauthorized: true, // SendGrid has valid certs
  },
  debug: false,
  logger: false,
});

// ✅ Verify transporter on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ [EMAIL] SendGrid verification failed!");
    console.error("   Error:", error.message);
    console.error("   Error code:", error.code);
    console.error("");
    console.error("   📝 Troubleshooting:");
    console.error("      1. Check EMAIL_USER is exactly 'apikey'");
    console.error(
      "      2. Check EMAIL_PASS is your full SendGrid API key (starts with SG.)"
    );
    console.error("      3. Verify your sender email at sendgrid.com");
    console.error("      4. Make sure API key has 'Mail Send' permission");
    console.error("");
  } else {
    console.log("✅ [EMAIL] SendGrid transporter ready!");
    console.log("   📧 Configured for:", process.env.EMAIL_FROM);
    console.log("   🚀 Using SendGrid for FAST delivery (1-3 seconds)");
    console.log("   💯 Free tier: 100 emails/day");
  }
});

// ✅ EXISTING FUNCTIONS (keep as-is)

// Function to send email to a member
async function sendExpiryEmail(member, daysUntilExpiry) {
  try {
    const expiryDate = new Date(
      member.membershipExpiryDate
    ).toLocaleDateString();
    let subject, message;

    if (daysUntilExpiry < 0) {
      subject = "Your Gym Membership Has Expired";
      message = `
        Dear ${member.username},
        
        We hope this email finds you well. We're writing to inform you that your gym membership has expired on ${expiryDate}.
        
        To continue enjoying our facilities and services, please renew your membership at your earliest convenience.
        
        If you have any questions or need assistance with the renewal process, please don't hesitate to contact our team.
        
        Thank you for being a valued member of our gym community.
        
        Best regards,
        The Gym Team
      `;
    } else if (daysUntilExpiry === 0) {
      subject = "Your Gym Membership Expires Today";
      message = `
        Dear ${member.username},
        
        This is a friendly reminder that your gym membership expires today (${expiryDate}).
        
        To avoid any interruption in your access to our facilities, please renew your membership as soon as possible.
        
        If you have any questions or need assistance with the renewal process, please don't hesitate to contact our team.
        
        Thank you for being a valued member of our gym community.
        
        Best regards,
        The Gym Team
      `;
    } else {
      subject = `Your Gym Membership Expires in ${daysUntilExpiry} Day${
        daysUntilExpiry > 1 ? "s" : ""
      }`;
      message = `
        Dear ${member.username},
        
        This is a friendly reminder that your gym membership will expire in ${daysUntilExpiry} day${
        daysUntilExpiry > 1 ? "s" : ""
      } on ${expiryDate}.
        
        To continue enjoying our facilities without interruption, please consider renewing your membership soon.
        
        If you have any questions or need assistance with the renewal process, please don't hesitate to contact our team.
        
        Thank you for being a valued member of our gym community.
        
        Best regards,
        The Gym Team
      `;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@gym.com",
      to: member.email,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, "<br>"),
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, email: member.email, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending email to ${member.email}:`, error);
    return { success: false, email: member.email, error: error.message };
  }
}

// Main function to get expired members and send emails
async function sendExpiryEmails() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const expiredMembers = await User.find({
      role: "user",
      membershipExpiryDate: { $lt: today },
    }).populate("membershipPlan");

    const expiringIn1Day = await User.find({
      role: "user",
      membershipExpiryDate: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("membershipPlan");

    const expiringIn2Days = await User.find({
      role: "user",
      membershipExpiryDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).populate("membershipPlan");

    const results = [];
    const allMembers = [
      ...expiredMembers,
      ...expiringIn1Day,
      ...expiringIn2Days,
    ];

    const batchSize = 10;
    for (let i = 0; i < allMembers.length; i += batchSize) {
      const batch = allMembers.slice(i, i + batchSize);

      const batchPromises = batch.map((member) => {
        let daysUntilExpiry;
        if (expiredMembers.includes(member)) {
          daysUntilExpiry = -1;
        } else if (expiringIn1Day.includes(member)) {
          daysUntilExpiry = 1;
        } else {
          daysUntilExpiry = 2;
        }
        return sendExpiryEmail(member, daysUntilExpiry);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + batchSize < allMembers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: true,
      message: `Email sending completed: ${successful} successful, ${failed} failed`,
      results: results,
    };
  } catch (error) {
    console.error("🔥 [EMAIL] Error in sendExpiryEmails:", error);
    return {
      success: false,
      message: `Error sending emails: ${error.message}`,
      error: error,
    };
  }
}

// Function to send a test email
async function sendTestEmail(toEmail) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@gym.com",
      to: toEmail,
      subject: "Test Email from Gym Management System",
      text: "This is a test email from the Gym Management System. If you receive this, email configuration is working correctly.",
      html: "<p>This is a test email from the Gym Management System. If you receive this, email configuration is working correctly.</p>",
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: `Test email sent successfully to ${toEmail}`,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`Error sending test email to ${toEmail}:`, error);
    return {
      success: false,
      message: `Error sending test email: ${error.message}`,
      error: error,
    };
  }
}

// Function to send welcome email
async function sendWelcomeEmail(userData, password, role) {
  try {
    let roleSpecificContent = "";

    if (role === "user") {
      roleSpecificContent = `
        Membership Details:
        - Membership Plan: ${userData.membership_name || "Not assigned"}
        - Membership Period: ${userData.membership_period || "Not assigned"}
        - Personal Training: ${userData.personal_trainer ? "Yes" : "No"}
        - Trainer Assigned: ${userData.trainerAssigned || "Self"}
        - Membership Expiry: ${
          userData.membershipExpiryDate
            ? new Date(userData.membershipExpiryDate).toLocaleDateString()
            : "Not assigned"
        }
      `;
    } else if (role === "trainer") {
      roleSpecificContent = `
        Trainer Details:
        - Experience: ${userData.experience || "Not specified"} years
        - Specialization: ${userData.specialization || "Not specified"}
      `;
    } else if (role === "admin") {
      roleSpecificContent = `
        Administrator Privileges:
        - Full access to gym management system
        - Ability to add/edit members, trainers, and memberships
        - Access to reports and analytics
      `;
    }

    const subject = `Welcome to Our Gym - Your ${
      role.charAt(0).toUpperCase() + role.slice(1)
    } Account Details`;
    const message = `
      Dear ${userData.username},
      
      Welcome to our gym community! We're excited to have you on board.
      
      Your account has been created successfully. Here are your login details:
      
      Username: ${userData.email}
      Password: ${password}
      
      ${roleSpecificContent}
      
      For security reasons, we recommend changing your password after your first login.
      
      If you have any questions or need assistance, please don't hesitate to contact our support team.
      
      Best regards,
      The Gym Team
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@gym.com",
      to: userData.email,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, "<br>"),
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, email: userData.email, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending welcome email to ${userData.email}:`, error);
    return { success: false, email: userData.email, error: error.message };
  }
}

module.exports = {
  sendExpiryEmails,
  sendTestEmail,
  sendWelcomeEmail,
  transporter,
};
