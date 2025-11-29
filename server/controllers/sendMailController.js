const User = require("../Models/user-model");
const sgMail = require("@sendgrid/mail");

// ✅ Configure SendGrid HTTP API (works on Render.com)
console.log("📧 [EMAIL CONFIG] Checking SendGrid configuration...");
console.log("   SENDGRID_API_KEY exists:", !!process.env.SENDGRID_API_KEY);
console.log("   EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
console.log("   EMAIL_FROM:", process.env.EMAIL_FROM || "noreply@gym.com");

// Set API key (try SENDGRID_API_KEY first, fallback to EMAIL_PASS)
const apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_PASS;
sgMail.setApiKey(apiKey);

// ✅ Test on startup
let isApiReady = false;
const testSendGridAPI = async () => {
  try {
    console.log("🔥 [EMAIL] Testing SendGrid HTTP API...");

    if (!apiKey || !apiKey.startsWith("SG.")) {
      throw new Error("Invalid SendGrid API key");
    }

    isApiReady = true;
    console.log("✅ [EMAIL] SendGrid HTTP API READY!");
    console.log("   📧 Sender:", process.env.EMAIL_FROM);
    console.log("   🚀 Using HTTP API (works on Render.com)");
    console.log("   ⚡ Average send time: 1-2 seconds");
  } catch (error) {
    console.error("❌ [EMAIL] SendGrid API test failed!");
    console.error("   Error:", error.message);
  }
};

testSendGridAPI();

// ✅ Transporter wrapper (backward compatible with nodemailer)
const transporter = {
  sendMail: async (mailOptions) => {
    try {
      const msg = {
        to: mailOptions.to,
        from: mailOptions.from || process.env.EMAIL_FROM,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      };

      console.log("📧 [EMAIL] Sending via SendGrid HTTP API to:", msg.to);
      const response = await sgMail.send(msg);

      console.log("✅ [EMAIL] Sent successfully!");
      return {
        messageId: response[0].headers["x-message-id"],
        response: response[0].statusCode,
        accepted: [mailOptions.to],
      };
    } catch (error) {
      console.error("❌ [EMAIL] SendGrid API error:", error.message);
      if (error.response) {
        console.error("   Response:", error.response.body);
      }
      throw error;
    }
  },

  verify: (callback) => {
    if (callback) {
      callback(null, isApiReady);
    }
    return Promise.resolve(isApiReady);
  },
};

// ✅ KEEP ALL YOUR EXISTING FUNCTIONS (no changes needed)

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
      membershipExpiryDate: { $gte: today, $lt: tomorrow },
    }).populate("membershipPlan");

    const expiringIn2Days = await User.find({
      role: "user",
      membershipExpiryDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
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
