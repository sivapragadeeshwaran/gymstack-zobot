const sessionStore = require("../utils/sessionStore");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.handleProblemReport = (message, res, session, visitorId) => {
  // Initialize problem report session if not already done
  if (!session.problemReportStep) {
    session.problemReportStep = "name";
    sessionStore.set(visitorId, session);
    return askForName(res, session, visitorId);
  }

  const msg = (message || "").toString().trim();

  // Handle "Back to Dashboard" at any point
  if (msg.includes("Back to Dashboard") || msg.includes("⬅️")) {
    session.problemReportStep = null;

    // Check user role and redirect to appropriate dashboard
    if (session.role === "trainer") {
      session.trainerStep = "dashboard";
      const trainerController = require("./zobottrainerController");
      return trainerController.showTrainerDashboard(res, session, visitorId);
    } else {
      session.memberStep = "dashboard";
      const memberController = require("./zobotmemberController");
      return memberController.showMemberDashboard(res, session, visitorId);
    }
  }

  // Handle different steps of problem reporting
  switch (session.problemReportStep) {
    case "name":
      return handleNameInput(msg, res, session, visitorId);
    case "email":
      return handleEmailInput(msg, res, session, visitorId);
    case "description":
      return handleDescriptionInput(msg, res, session, visitorId);
    case "confirm":
      return handleConfirmation(msg, res, session, visitorId);
    default:
      session.problemReportStep = "name";
      sessionStore.set(visitorId, session);
      return askForName(res, session, visitorId);
  }
};

function askForName(res, session, visitorId) {
  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: ["Great! May I know your name?"],
    input: {
      type: "name",
      placeholder: "Enter your name",
      value: "",
      error: ["Enter name as per govt issued id"],
    },
    suggestions: ["⬅️ Back to Dashboard"],
  });
}

function handleNameInput(message, res, session, visitorId) {
  // Validate name (non-empty)
  if (!message || message.trim().length < 2) {
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter a valid name (at least 2 characters):"],
      input: {
        type: "name",
        placeholder: "Enter your name",
        value: "",
        error: ["Enter name as per govt issued id"],
      },
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }

  // Store name in session
  session.problemReportName = message.trim();
  session.problemReportStep = "email";
  sessionStore.set(visitorId, session);

  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: ["And your email address?"],
    input: {
      type: "email",
      placeholder: "Enter the email address",
      value: "",
      error: ["Enter a valid email address"],
    },
    suggestions: ["⬅️ Back to Dashboard"],
  });
}

function handleEmailInput(message, res, session, visitorId) {
  // Validate email
  const emailRegex = /\S+@\S+\.\S+/;
  if (!emailRegex.test(message)) {
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter a valid email address:"],
      input: {
        type: "email",
        placeholder: "Enter the email address",
        value: "",
        error: ["Enter a valid email address"],
      },
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }

  // Store email in session
  session.problemReportEmail = message.trim();
  session.problemReportStep = "description";
  sessionStore.set(visitorId, session);

  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: ["Thank you! Please describe your problem in detail:"],
    suggestions: ["⬅️ Back to Dashboard"],
  });
}

function handleDescriptionInput(message, res, session, visitorId) {
  // Validate description (non-empty)
  if (!message || message.trim().length < 10) {
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Please provide a more detailed description (at least 10 characters):",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }

  // Store description in session
  session.problemReportDescription = message.trim();
  session.problemReportStep = "confirm";
  sessionStore.set(visitorId, session);

  // Show confirmation message
  const confirmation =
    `Please confirm your problem report:\n\n` +
    `Name: ${session.problemReportName}\n` +
    `Email: ${session.problemReportEmail}\n` +
    `Problem: ${session.problemReportDescription}\n\n` +
    `Is this correct?`;

  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: [confirmation],
    suggestions: [
      "✅ Yes, Submit",
      "🔄 No, Start Over",
      "⬅️ Back to Dashboard",
    ],
  });
}

async function handleConfirmation(message, res, session, visitorId) {
  console.log("🔍 [CONFIRMATION] Received message:", message);
  console.log("🔍 [CONFIRMATION] Message type:", typeof message);
  console.log(
    "🔍 [CONFIRMATION] Message includes 'Yes':",
    message.includes("Yes")
  );
  console.log(
    "🔍 [CONFIRMATION] Message includes 'Submit':",
    message.includes("Submit")
  );

  // ✅ FIXED: Use .includes() to check for keywords instead of exact match
  if (message.includes("Yes") && message.includes("Submit")) {
    try {
      console.log("✅ [CONFIRMATION] Submitting problem report...");

      // Send email to admin
      await sendEmailToAdmin(session);

      // Send confirmation email to user
      await sendConfirmationEmail(session);

      console.log("✅ [CONFIRMATION] Emails sent successfully");

      // Clear problem report data from session
      session.problemReportStep = null;
      session.problemReportName = null;
      session.problemReportEmail = null;
      session.problemReportDescription = null;

      // Show success message with role-based suggestions
      const successMessage =
        "✅ We have collected your problem. We will analyze it and resolve it soon.";

      if (session.role === "trainer") {
        session.trainerStep = "dashboard";
        sessionStore.set(visitorId, session);

        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [successMessage],
          suggestions: [
            "👥 View Members",
            "📝 Update Profile",
            "📅 Add Class Schedule",
            "🚨 Report an Issue",
            "🤖 Talk to AI Assistant",
          ],
        });
      } else {
        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);

        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [successMessage],
          suggestions: [
            "📋 Membership Status",
            "💳 Renew Membership",
            "📅 Show Today's / Weekly Class",
            "👤 Update Profile",
            "📊 BMI Calculator",
            "🤖 Talk to AI Assistant",
            "⚠️ Report a Problem",
          ],
        });
      }
    } catch (error) {
      console.error("🔥 [PROBLEM_REPORT] Error sending emails:", error);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Sorry, there was an error submitting your problem. Please try again later.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }
  } else if (message.includes("No") && message.includes("Start Over")) {
    console.log("🔄 [CONFIRMATION] Starting over...");

    // Reset problem report session
    session.problemReportStep = "name";
    session.problemReportName = null;
    session.problemReportEmail = null;
    session.problemReportDescription = null;
    sessionStore.set(visitorId, session);

    return askForName(res, session, visitorId);
  } else {
    console.log("❌ [CONFIRMATION] Invalid option selected");

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please select a valid option:"],
      suggestions: [
        "✅ Yes, Submit",
        "🔄 No, Start Over",
        "⬅️ Back to Dashboard",
      ],
    });
  }
}

async function sendEmailToAdmin(session) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject:
      "🚨 New Problem Report from Gym " +
      (session.role === "trainer" ? "Trainer" : "Member"),
    html: `
      <h2>New Problem Report</h2>
      <p>A new problem report has been submitted by a ${
        session.role === "trainer" ? "trainer" : "member"
      }:</p>
      <hr>
      <p><strong>Name:</strong> ${session.problemReportName}</p>
      <p><strong>Email:</strong> ${session.problemReportEmail}</p>
      <p><strong>Problem:</strong></p>
      <p>${session.problemReportDescription}</p>
      <hr>
      <p><em>This is an automated message from Strength Zone Gym Bot</em></p>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("📧 Admin email sent successfully");
}

async function sendConfirmationEmail(session) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: session.problemReportEmail,
    subject: "✅ We have received your problem report",
    html: `
      <h2>Thank you for reporting your issue</h2>
      <p>Dear ${session.problemReportName},</p>
      <p>We have received your problem report and our team will review it shortly.</p>
      <hr>
      <p><strong>Your Report:</strong></p>
      <p>${session.problemReportDescription}</p>
      <hr>
      <p>We appreciate your patience and will get back to you as soon as possible.</p>
      <br>
      <p>Best regards,<br>
      <strong>Strength Zone Gym Team</strong></p>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("📧 Confirmation email sent successfully");
}
