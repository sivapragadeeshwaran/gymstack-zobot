const sessionStore = require("../utils/sessionStore");
const Plan = require("../Models/plan");
const User = require("../Models/user-model");
const Trainer = require("../Models/trainer-model");
const bcrypt = require("bcryptjs");
const { sendExpiryEmails, sendWelcomeEmail } = require("./sendMailController");
const {
  handleViewReports,
  handleReportTypeSelection,
} = require("./reportsController");

// Helper function to generate a random password
function generateRandomPassword(length = 8) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

exports.handleAdmin = (message, res, session, visitorId) => {
  // Initialize admin session if not already done
  if (!session.adminStep) {
    session.adminStep = "dashboard";
    sessionStore.set(visitorId, session);
  }

  const msg = (message || "").toString().trim();

  // Handle response to reminder email question
  if (session.adminStep === "expiringMembers_reminder") {
    return handleReminderResponse(msg, res, session, visitorId);
  }

  // Handle view reports selection
  if (
    session.adminStep === "viewReports_selectType" ||
    session.adminStep === "viewReports_viewing"
  ) {
    return handleReportTypeSelection(msg, res, session, visitorId);
  }

  // Handle navigation from View Reports
  if (session.adminStep === "viewReports") {
    return handleViewReportsNavigation(msg, res, session, visitorId);
  }

  if (session.adminStep === "dashboard") {
    switch (msg) {
      case "➕ Add Member":
        session.adminStep = "addMember_name";
        sessionStore.set(visitorId, session);
        return handleAddMemberForm("", res, session, visitorId);
      case "🏋️ Add Trainer":
        session.adminStep = "addTrainer_name";
        sessionStore.set(visitorId, session);
        return handleAddTrainer("", res, session, visitorId);
      case "🔑 Add Admin":
        session.adminStep = "addAdmin_name";
        sessionStore.set(visitorId, session);
        return handleAddAdmin("", res, session, visitorId);
      case "💳 Add New Membership":
        session.adminStep = "addMembership_name";
        sessionStore.set(visitorId, session);
        return handleAddMembership("", res, session, visitorId);
      case "⏰ Expiring Members":
        session.adminStep = "expiringMembers";
        sessionStore.set(visitorId, session);
        return handleExpiringMembers(res, session, visitorId);
      case "📊 View Reports":
        return handleViewReports(res, session, visitorId);
      case "⬅️ Back to Dashboard":
        return showAdminDashboard(res, session, visitorId);
      default:
        return showAdminDashboard(res, session, visitorId);
    }
  }

  // Handle form submission steps
  switch (session.adminStep) {
    // Add Member Form steps
    case "addMember_name":
    case "addMember_email":
    case "addMember_dob":
    case "addMember_phone":
    case "addMember_membership":
    case "addMember_trainer":
    case "addMember_trainer_selection":
      return handleAddMemberForm(msg, res, session, visitorId);

    // Add Trainer steps
    case "addTrainer_name":
    case "addTrainer_email":
    case "addTrainer_phone":
    case "addTrainer_experience":
    case "addTrainer_specialization":
      return handleAddTrainer(msg, res, session, visitorId);

    // Add Admin steps
    case "addAdmin_email":
    case "addAdmin_name":
    case "addAdmin_phone":
      return handleAddAdmin(msg, res, session, visitorId);

    // Add Membership steps
    case "addMembership_name":
    case "addMembership_period":
    case "addMembership_price":
    case "addMembership_personalTraining":
      return handleAddMembership(msg, res, session, visitorId);

    default:
      // fallback to dashboard
      session.adminStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showAdminDashboard(res, session, visitorId);
  }
};

// ----------------------- Dashboard -----------------------
function showAdminDashboard(res, session, visitorId) {
  const greeting = `👋 Welcome Admin ${
    session.username || ""
  }! Here's your dashboard:`;

  const payload = {
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: [greeting],
    suggestions: [
      "➕ Add Member",
      "🏋️ Add Trainer",
      "🔑 Add Admin",
      "💳 Add New Membership",
      "⏰ Expiring Members",
      "📊 View Reports",
    ],
  };

  // Make sure session step is dashboard
  session.adminStep = "dashboard";
  sessionStore.set(visitorId, session);

  // Zoho will send back the chosen suggestion as message text
  return res.json(payload);
}

// ----------------------- View Reports Navigation -----------------------
function handleViewReportsNavigation(message, res, session, visitorId) {
  switch (message) {
    case "➕ Add Member":
      session.adminStep = "addMember_name";
      sessionStore.set(visitorId, session);
      return handleAddMemberForm("", res, session, visitorId);

    case "🏋️ Add Trainer":
      session.adminStep = "addTrainer_name";
      sessionStore.set(visitorId, session);
      return handleAddTrainer("", res, session, visitorId);

    case "🔑 Add Admin":
      session.adminStep = "addAdmin_name";
      sessionStore.set(visitorId, session);
      return handleAddAdmin("", res, session, visitorId);

    case "💳 Add New Membership":
      session.adminStep = "addMembership_name";
      sessionStore.set(visitorId, session);
      return handleAddMembership("", res, session, visitorId);

    case "⏰ Expiring Members":
      session.adminStep = "expiringMembers";
      sessionStore.set(visitorId, session);
      return handleExpiringMembers(res, session, visitorId);

    case "⬅️ Back to Dashboard":
      session.adminStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showAdminDashboard(res, session, visitorId);

    default:
      return handleViewReports(res, session, visitorId);
  }
}

// ----------------------- Expiring Members -----------------------
async function handleExpiringMembers(res, session, visitorId) {
  try {
    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day

    // Calculate dates for 1 day and 2 days from now
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Find users with expired memberships
    const expiredMembers = await User.find({
      role: "user",
      membershipExpiryDate: { $lt: today },
    }).populate("membershipPlan");

    // Find users with memberships expiring in 1 day
    const expiringIn1Day = await User.find({
      role: "user",
      membershipExpiryDate: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("membershipPlan");

    // Find users with memberships expiring in 2 days
    const expiringIn2Days = await User.find({
      role: "user",
      membershipExpiryDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).populate("membershipPlan");

    // Prepare the response as a single string
    let reportContent = "⏰ MEMBERSHIP EXPIRY REPORT\n\n";

    // Add expired members section
    reportContent += "❌ EXPIRED MEMBERSHIPS:\n";
    if (expiredMembers.length === 0) {
      reportContent += "• No members with expired memberships\n";
    } else {
      expiredMembers.forEach((member) => {
        const expiryDate = new Date(
          member.membershipExpiryDate
        ).toLocaleDateString();
        reportContent += `• ${member.username} - Expired on ${expiryDate}\n`;
      });
    }
    reportContent += "\n";

    // Add expiring in 1 day section
    reportContent += "⚠️ EXPIRING IN 1 DAY:\n";
    if (expiringIn1Day.length === 0) {
      reportContent += "• No members with memberships expiring tomorrow\n";
    } else {
      expiringIn1Day.forEach((member) => {
        const expiryDate = new Date(
          member.membershipExpiryDate
        ).toLocaleDateString();
        const planName = member.membershipPlan
          ? member.membershipPlan.name
          : "Unknown Plan";
        reportContent += `• ${member.username} - ${planName} - Expires on ${expiryDate}\n`;
      });
    }
    reportContent += "\n";

    // Add expiring in 2 days section
    reportContent += "⏱️ EXPIRING IN 2 DAYS:\n";
    if (expiringIn2Days.length === 0) {
      reportContent += "• No members with memberships expiring in 2 days\n";
    } else {
      expiringIn2Days.forEach((member) => {
        const expiryDate = new Date(
          member.membershipExpiryDate
        ).toLocaleDateString();
        const planName = member.membershipPlan
          ? member.membershipPlan.name
          : "Unknown Plan";
        reportContent += `• ${member.username} - ${planName} - Expires on ${expiryDate}\n`;
      });
    }

    // Add question about sending reminders
    reportContent +=
      "\nWould you like to send reminder emails to all these members?";

    // Set session step to track if we're waiting for a response to the reminder question
    session.adminStep = "expiringMembers_reminder";
    sessionStore.set(visitorId, session);

    const payload = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [reportContent], // Single message with the entire report
      suggestions: ["Yes", "No"],
    };

    return res.json(payload);
  } catch (error) {
    console.error("🔥 [ADMIN] Error fetching expiring members:", error);

    const errorPayload = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving the membership expiry information. Please try again later.",
      ],
      suggestions: [
        "➕ Add Member",
        "🏋️ Add Trainer",
        "🔑 Add Admin",
        "💳 Add New Membership",
        "⏰ Expiring Members",
        "⬅️ Back to Dashboard",
      ],
    };

    return res.json(errorPayload);
  }
}

// ----------------------- Handle Reminder Response -----------------------
async function handleReminderResponse(message, res, session, visitorId) {
  if (message === "Yes") {
    // Immediately respond that the process has started
    const initialResponse = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "✅ Email notifications have been sent successfully to all members whose plans are nearing expiry",
      ],
      suggestions: [
        "➕ Add Member",
        "🏋️ Add Trainer",
        "🔑 Add Admin",
        "💳 Add New Membership",
        "⏰ Expiring Members",
        "⬅️ Back to Dashboard",
      ],
    };

    // Send the initial response
    res.json(initialResponse);

    // Reset session to dashboard
    session.adminStep = "dashboard";
    sessionStore.set(visitorId, session);

    // Now, send the emails in the background without waiting
    sendExpiryEmails()
      .then((result) => {
        // Log the result, but we cannot send another response to the same request
        console.log("🔥 [ADMIN] Email sending completed:", result);
      })
      .catch((error) => {
        console.error("🔥 [ADMIN] Error sending reminder emails:", error);
      });

    return; // We've already sent the response
  } else if (message === "No") {
    // Reset session to dashboard
    session.adminStep = "dashboard";
    sessionStore.set(visitorId, session);

    return showAdminDashboard(res, session, visitorId);
  } else {
    // Invalid response, ask again
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please select a valid option: Yes or No"],
      suggestions: ["Yes", "No"],
    });
  }
}

// ----------------------- Add Membership Flow -----------------------
async function handleAddMembership(message, res, session, visitorId) {
  // Initialize form data if not exists
  if (!session.membershipData) {
    session.membershipData = {};
    sessionStore.set(visitorId, session);
  }

  // Step 1: Membership Name
  if (session.adminStep === "addMembership_name") {
    if (!message) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter the membership plan name:"],
        input: {
          type: "name",
          placeholder: "Enter membership plan name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Handle different response formats from Zoho
    let nameValue = message;
    if (message && typeof message === "object" && message.value) {
      nameValue = message.value;
    }

    // Validate name
    if (!nameValue || nameValue.trim().length < 2) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter a valid membership name (at least 2 characters):",
        ],
        input: {
          type: "name",
          placeholder: "Enter membership plan name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Store name and move to next step
    session.membershipData.name = nameValue;
    session.adminStep = "addMembership_period";
    sessionStore.set(visitorId, session);

    // Show period options
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Select the membership period:"],
      input: {
        type: "select",
        name: "membership_period",
        label: "Membership Period",
        placeholder: "Choose membership period",
        mandatory: true,
        options: [
          { text: "1 Month", value: "1 Month" },
          { text: "3 Months", value: "3 Months" },
          { text: "6 Months", value: "6 Months" },
          { text: "12 Months", value: "12 Months" },
        ],
      },
    });
  }

  // Step 2: Period
  if (session.adminStep === "addMembership_period") {
    // Process the selected period
    let periodValue = message;

    // Handle different response formats from Zoho
    if (message && typeof message === "object" && message.value) {
      periodValue = message.value;
    }

    // Validate that a period is selected
    const validPeriods = ["1 Month", "3 Months", "6 Months", "12 Months"];
    if (!validPeriods.includes(periodValue)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Invalid membership period selected. Please try again."],
        input: {
          type: "select",
          name: "membership_period",
          label: "Membership Period",
          placeholder: "Choose membership period",
          mandatory: true,
          options: [
            { text: "1 Month", value: "1 Month" },
            { text: "3 Months", value: "3 Months" },
            { text: "6 Months", value: "6 Months" },
            { text: "12 Months", value: "12 Months" },
          ],
        },
      });
    }

    // Store period and move to next step
    session.membershipData.period = periodValue;
    session.adminStep = "addMembership_price";
    sessionStore.set(visitorId, session);

    // Show price input
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Enter the membership price (in rupees, numbers only):"],
    });
  }

  // Step 3: Price
  if (session.adminStep === "addMembership_price") {
    // Check if message is empty
    if (!message || message.trim() === "") {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter the membership price (in rupees, numbers only):",
        ],
      });
    }

    // Check if input contains only numbers
    if (!/^\d+$/.test(message.trim())) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Invalid input. Please enter numbers only for the price:"],
      });
    }

    // Parse price as integer
    const price = parseInt(message.trim(), 10);

    // Validate price range
    if (isNaN(price) || price <= 0 || price > 100000) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid price (1-100000 rupees):"],
      });
    }

    // Store price and move to next step
    session.membershipData.price = price;
    session.adminStep = "addMembership_personalTraining";
    sessionStore.set(visitorId, session);

    // Show personal training options
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Does this membership include personal training?"],
      suggestions: ["Yes", "No"],
    });
  }

  // Step 4: Personal Training
  if (session.adminStep === "addMembership_personalTraining") {
    if (!["Yes", "No"].includes(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please select a valid option:"],
        suggestions: ["Yes", "No"],
      });
    }

    // Store personal training preference
    session.membershipData.includesPersonalTraining = message === "Yes";
    sessionStore.set(visitorId, session);

    // Save to database
    try {
      // Create new membership plan with the form data
      const newPlan = new Plan({
        name: session.membershipData.name,
        period: session.membershipData.period,
        price: session.membershipData.price,
        includesPersonalTraining:
          session.membershipData.includesPersonalTraining,
      });

      // Save the plan to the database
      const savedPlan = await newPlan.save();

      // Prepare confirmation as a single string
      let confirmation = `✅ Membership plan "${session.membershipData.name}" has been added successfully!\n`;
      confirmation += `Period: ${session.membershipData.period}\n`;
      confirmation += `Price: ${session.membershipData.price} INR\n`;
      confirmation += `Includes Personal Training: ${
        session.membershipData.includesPersonalTraining ? "Yes" : "No"
      }`;

      // Reset session
      session.adminStep = "dashboard";
      const formData = session.membershipData;
      session.membershipData = null;
      sessionStore.set(visitorId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [confirmation], // Single message with the entire confirmation
        suggestions: [
          "➕ Add Member",
          "🏋️ Add Trainer",
          "🔑 Add Admin",
          "💳 Add New Membership",
          "⏰ Expiring Members",
          "📊 View Reports",
        ],
      });
    } catch (error) {
      console.error(
        "🔥 [ADMIN] Error saving membership plan to database:",
        error
      );

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message
        );
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "Validation error:",
            ...validationErrors,
            "Please correct the errors and try again.",
          ],
        });
      }

      // Handle other errors
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Sorry, there was an error creating the membership plan. Please try again later.",
        ],
      });
    }
  }

  // Fallback

  session.adminStep = "dashboard";
  sessionStore.set(visitorId, session);
  return showAdminDashboard(res, session, visitorId);
}

// ----------------------- Add Member Form (Step-by-Step) -----------------------
async function handleAddMemberForm(message, res, session, visitorId) {
  // Initialize form data if not exists
  if (!session.memberFormData) {
    session.memberFormData = {};
    sessionStore.set(visitorId, session);
  }

  // Step 1: Name
  if (session.adminStep === "addMember_name") {
    if (!message) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter the member's full name:"],
        input: {
          type: "name",
          placeholder: "Enter member's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Handle different response formats from Zoho
    let nameValue = message;
    if (message && typeof message === "object" && message.value) {
      nameValue = message.value;
    }

    // Validate name
    if (!nameValue || nameValue.trim().length < 2) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid name (at least 2 characters):"],
        input: {
          type: "name",
          placeholder: "Enter member's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Store name and move to next step
    session.memberFormData.name = nameValue;
    session.adminStep = "addMember_email";
    sessionStore.set(visitorId, session);

    // Show email input (email type is supported)
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter the member's email:"],
      input: {
        type: "email",
        name: "email",
        placeholder: "member@example.com",
        label: "Email Address",
        mandatory: true,
      },
    });
  }

  // Step 2: Email
  if (session.adminStep === "addMember_email") {
    // Validate email
    if (!validateEmail(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "That doesn't look like a valid email. Please enter a valid email address:",
        ],
        input: {
          type: "email",
          name: "email",
          placeholder: "member@example.com",
          label: "Email Address",
          mandatory: true,
        },
      });
    }

    // Check if email already exists
    try {
      const existingUser = await User.findOne({ email: message });
      if (existingUser) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "This email is already registered. Please use a different email address:",
          ],
          input: {
            type: "email",
            name: "email",
            placeholder: "member@example.com",
            label: "Email Address",
            mandatory: true,
          },
        });
      }
    } catch (error) {
      console.error("🔥 [ADMIN] Error checking email:", error);
    }

    // Store email and move to next step
    session.memberFormData.email = message;
    session.adminStep = "addMember_dob";
    sessionStore.set(visitorId, session);

    // Show DOB input as plain text (like name)
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter the member's date of birth (YYYY-MM-DD):"],
    });
  }

  // Step 3: Date of Birth
  if (session.adminStep === "addMember_dob") {
    // If no message, show the prompt
    if (!message) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter the member's date of birth (YYYY-MM-DD):"],
      });
    }

    // Validate DOB format (YYYY-MM-DD)
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid date of birth in YYYY-MM-DD format:"],
      });
    }

    // Additional validation to ensure it's a reasonable date
    const dateParts = message.split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const currentYear = new Date().getFullYear();

    // Basic validation for year (not in the future and not too far in the past)
    if (year > currentYear || year < currentYear - 120) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid year for date of birth (YYYY-MM-DD):"],
      });
    }

    // Basic validation for month (1-12)
    if (month < 1 || month > 12) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid month for date of birth (YYYY-MM-DD):"],
      });
    }

    // Basic validation for day (1-31)
    if (day < 1 || day > 31) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid day for date of birth (YYYY-MM-DD):"],
      });
    }

    // Store DOB and move to next step
    session.memberFormData.dob = message;
    session.adminStep = "addMember_phone";
    sessionStore.set(visitorId, session);

    // Show phone input with telephone type
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Please enter the member's phone number (with or without country code):",
      ],
      input: {
        type: "tel",
        name: "phone",
        placeholder: "9876543210",
        label: "Phone Number",
        mandatory: true,
      },
    });
  }

  // Step 4: Phone Number
  if (session.adminStep === "addMember_phone") {
    // Clean the phone number by removing all non-digit characters
    const cleanPhone = message.replace(/\D/g, "");

    // Remove '91' country code if present at the beginning
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
      finalPhone = cleanPhone.substring(2);
    }

    // Phone validation (exactly 10 digits after cleaning)
    const phoneRegex = /^\d{10}$/;

    if (!phoneRegex.test(finalPhone)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter a valid 10-digit phone number (with or without country code):",
        ],
        input: {
          type: "tel",
          name: "phone",
          placeholder: "9876543210",
          label: "Phone Number",
          mandatory: true,
        },
      });
    }

    // Store phone and move to next step
    session.memberFormData.phone = finalPhone; // Store clean phone number
    session.adminStep = "addMember_membership";
    sessionStore.set(visitorId, session);

    // Fetch membership plans and show options
    try {
      // Use the Plan model to get all plans
      const plans = await Plan.find();

      if (plans && plans.length > 0) {
        // Format options for the select dropdown
        const options = plans.map((plan) => ({
          text: `${plan.name} - ${plan.period} (${plan.price} INR)`,
          value: plan._id.toString(),
        }));

        // Store plans in session for later use
        session.plansData = plans;
        sessionStore.set(visitorId, session);

        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: ["What type of membership would you like to assign?"],
          input: {
            type: "select",
            name: "membership_type",
            label: "Membership Type",
            placeholder: "Choose membership type",
            mandatory: true,
            options: options,
          },
        });
      } else {
        console.error("🔥 [ADMIN] No plans found");
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "Sorry, no membership plans are available at the moment. Please try again later.",
          ],
        });
      }
    } catch (error) {
      console.error("🔥 [ADMIN] Error fetching membership plans:", error);
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Sorry, there was an error retrieving membership plans. Please try again later.",
        ],
      });
    }
  }

  // Step 5: Membership Type
  if (session.adminStep === "addMember_membership") {
    // Process the selected membership
    let membershipValue = message;
    let selectedPlan = null;

    // Handle different response formats from Zoho
    if (message && typeof message === "object" && message.value) {
      membershipValue = message.value;

      // Find the selected plan by ID
      selectedPlan = session.plansData.find(
        (plan) => plan._id.toString() === membershipValue
      );
    }
    // If it's a string, try to match by the display text
    else if (typeof message === "string") {
      // Find the selected plan by matching the display text
      selectedPlan = session.plansData.find((plan) => {
        const displayText = `${plan.name} - ${plan.period} (${plan.price} INR)`;
        return displayText === message;
      });
    }

    // Validate that a membership type is selected
    if (!selectedPlan) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Invalid membership plan selected. Please try again."],
        input: {
          type: "select",
          name: "membership_type",
          label: "Membership Type",
          placeholder: "Choose membership type",
          mandatory: true,
          options: session.plansData.map((plan) => ({
            text: `${plan.name} - ${plan.period} (${plan.price} INR)`,
            value: plan._id.toString(),
          })),
        },
      });
    }

    // Store membership details
    session.memberFormData.membership_type = selectedPlan._id;
    session.memberFormData.membership_name = selectedPlan.name;
    session.memberFormData.membership_period = selectedPlan.period;
    session.memberFormData.membership_price = selectedPlan.price;
    session.memberFormData.includesPersonalTraining =
      selectedPlan.includesPersonalTraining;

    sessionStore.set(visitorId, session);

    // Check if membership includes personal training
    if (selectedPlan.includesPersonalTraining) {
      // Ask if they want a personal trainer
      session.adminStep = "addMember_trainer";
      sessionStore.set(visitorId, session);
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Would the member like a personal trainer?"],
        suggestions: ["Yes", "No"],
      });
    } else {
      // If membership doesn't include personal training, proceed directly to add member
      session.memberFormData.personal_trainer = false;
      session.memberFormData.trainerAssigned = "Self";
      return addMemberToDatabase(res, session, visitorId);
    }
  }

  // Step 6: Personal Trainer (only if membership includes personal training)
  if (session.adminStep === "addMember_trainer") {
    if (!["Yes", "No"].includes(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please select a valid option:"],
        suggestions: ["Yes", "No"],
      });
    }

    if (message === "Yes") {
      session.adminStep = "addMember_trainer_selection";
      sessionStore.set(visitorId, session);
      return showTrainerSelection(res, session, visitorId);
    } else {
      // User selected "No" - inform them to select trainer on website

      session.memberFormData.personal_trainer = false;
      session.memberFormData.trainerAssigned = "Self";
      return addMemberToDatabase(
        res,
        session,
        visitorId,
        "Please inform the user to select a trainer on the website."
      );
    }
  }

  // Step 7: Trainer Selection (after showing the selection dropdown)
  if (session.adminStep === "addMember_trainer_selection") {
    // Process the selected trainer
    let trainerValue = message;
    let selectedTrainer = null;

    // Handle different response formats from Zoho
    if (message && typeof message === "object" && message.value) {
      trainerValue = message.value;

      // Find the selected trainer by ID
      selectedTrainer = session.trainersData.find(
        (trainer) => trainer._id.toString() === trainerValue
      );
    }
    // If it's a string, try to match by the display text
    else if (typeof message === "string") {
      // Find the selected trainer by matching the display text
      selectedTrainer = session.trainersData.find((trainer) => {
        const displayText = `${trainer.name} - ${trainer.specialization}`;
        return displayText === message;
      });
    }

    // Validate that a trainer is selected
    if (!selectedTrainer) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Invalid trainer selected. Please try again."],
        input: {
          type: "select",
          name: "trainer_selection",
          label: "Select Trainer",
          placeholder: "Choose a trainer",
          mandatory: true,
          options: session.trainersData.map((trainer) => ({
            text: `${trainer.name} - ${trainer.specialization}`,
            value: trainer._id.toString(),
          })),
        },
      });
    }

    // Store trainer details and proceed to add member
    session.memberFormData.trainer_id = selectedTrainer._id;
    session.memberFormData.trainerAssigned = "Yes"; // Use "Yes" instead of trainer name
    session.memberFormData.personal_trainer = true;
    sessionStore.set(visitorId, session);

    return addMemberToDatabase(res, session, visitorId);
  }

  // Fallback

  session.adminStep = "dashboard";
  sessionStore.set(visitorId, session);
  return showAdminDashboard(res, session, visitorId);
}

// ----------------------- Add Trainer Flow -----------------------
async function handleAddTrainer(message, res, session, visitorId) {
  // Initialize form data if not exists
  if (!session.trainerFormData) {
    session.trainerFormData = {};
    sessionStore.set(visitorId, session);
  }

  // Step 1: Name
  if (session.adminStep === "addTrainer_name") {
    if (!message) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter the trainer's full name:"],
        input: {
          type: "name",
          placeholder: "Enter trainer's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Handle different response formats from Zoho
    let nameValue = message;
    if (message && typeof message === "object" && message.value) {
      nameValue = message.value;
    }

    // Validate name
    if (!nameValue || nameValue.trim().length < 2) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid name (at least 2 characters):"],
        input: {
          type: "name",
          placeholder: "Enter trainer's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Store name and move to next step
    session.trainerFormData.name = nameValue;
    session.adminStep = "addTrainer_email";
    sessionStore.set(visitorId, session);

    // Show email input (email type is supported)
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter the trainer's email:"],
      input: {
        type: "email",
        name: "email",
        placeholder: "trainer@example.com",
        label: "Email Address",
        mandatory: true,
      },
    });
  }

  // Step 2: Email
  if (session.adminStep === "addTrainer_email") {
    // Validate email
    if (!validateEmail(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "That doesn't look like a valid email. Please enter a valid email address:",
        ],
        input: {
          type: "email",
          name: "email",
          placeholder: "trainer@example.com",
          label: "Email Address",
          mandatory: true,
        },
      });
    }

    // Check if email already exists
    try {
      const existingUser = await User.findOne({ email: message });
      if (existingUser) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "This email is already registered. Please use a different email address:",
          ],
          input: {
            type: "email",
            name: "email",
            placeholder: "trainer@example.com",
            label: "Email Address",
            mandatory: true,
          },
        });
      }
    } catch (error) {
      console.error("🔥 [ADMIN] Error checking email:", error);
    }

    // Store email and move to next step
    session.trainerFormData.email = message;
    session.adminStep = "addTrainer_phone";
    sessionStore.set(visitorId, session);

    // Show phone input with telephone type
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Please enter the trainer's phone number (with or without country code):",
      ],
      input: {
        type: "tel",
        name: "phone",
        placeholder: "9876543210",
        label: "Phone Number",
        mandatory: true,
      },
    });
  }

  // Step 3: Phone Number
  if (session.adminStep === "addTrainer_phone") {
    // Clean the phone number by removing all non-digit characters
    const cleanPhone = message.replace(/\D/g, "");

    // Remove '91' country code if present at the beginning
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
      finalPhone = cleanPhone.substring(2);
    }

    // Phone validation (exactly 10 digits after cleaning)
    const phoneRegex = /^\d{10}$/;

    if (!phoneRegex.test(finalPhone)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter a valid 10-digit phone number (with or without country code):",
        ],
        input: {
          type: "tel",
          name: "phone",
          placeholder: "9876543210",
          label: "Phone Number",
          mandatory: true,
        },
      });
    }

    // Store phone and move to next step
    session.trainerFormData.phone = finalPhone; // Store clean phone number
    session.adminStep = "addTrainer_experience";
    sessionStore.set(visitorId, session);

    // Show experience input as plain text
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Please enter the trainer's years of experience (numbers only):",
      ],
    });
  }

  // Step 4: Experience
  if (session.adminStep === "addTrainer_experience") {
    // Check if message is empty
    if (!message || message.trim() === "") {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter the trainer's years of experience (numbers only):",
        ],
      });
    }

    // Check if input contains only numbers
    if (!/^\d+$/.test(message.trim())) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Invalid input. Please enter numbers only for years of experience:",
        ],
      });
    }

    // Parse experience as integer
    const experience = parseInt(message.trim(), 10);

    // Validate experience range
    if (isNaN(experience) || experience < 0 || experience > 50) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid number of years (0-50):"],
      });
    }

    // Store experience and move to next step
    session.trainerFormData.experience = experience;
    session.adminStep = "addTrainer_specialization";
    sessionStore.set(visitorId, session);

    // Show specialization input
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "What is the trainer's specialization? (e.g., Yoga, Weightlifting, Cardio)",
      ],
    });
  }

  // Step 5: Specialization
  if (session.adminStep === "addTrainer_specialization") {
    // Validate specialization
    if (!message || message.trim().length < 2) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter a valid specialization (at least 2 characters):",
        ],
      });
    }

    // Store specialization
    session.trainerFormData.specialization = message.trim();
    sessionStore.set(visitorId, session);

    // Save to database
    try {
      // Generate a random password
      const generatedPassword = generateRandomPassword(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Get current date for feePaidDate
      const currentDate = new Date();

      // Create new user with the form data
      const newUser = new User({
        username: session.trainerFormData.name,
        email: session.trainerFormData.email,
        password: hashedPassword,
        role: "trainer",
        phone: session.trainerFormData.phone,
        feePaidDate: currentDate,
        firstLogin: true,
        addedBy: "admin",
      });

      // Save the user to the database
      const savedUser = await newUser.save();

      // Create trainer profile
      const newTrainer = new Trainer({
        userId: savedUser._id,
        name: session.trainerFormData.name,
        experience: session.trainerFormData.experience,
        specialization: session.trainerFormData.specialization,
      });

      // Save the trainer to the database
      const savedTrainer = await newTrainer.save();

      // Send welcome email with credentials
      const emailData = {
        username: session.trainerFormData.name,
        email: session.trainerFormData.email,
        experience: session.trainerFormData.experience,
        specialization: session.trainerFormData.specialization,
      };

      // Send email in the background without waiting
      sendWelcomeEmail(emailData, generatedPassword, "trainer")
        .then((emailResult) => {})
        .catch((emailError) => {
          console.error("🔥 [ADMIN] Error sending welcome email:", emailError);
        });

      // Prepare confirmation as a single string
      let confirmation = `✅ Trainer ${session.trainerFormData.name} has been added successfully!\n`;
      confirmation += `Email: ${session.trainerFormData.email}\n`;
      confirmation += `Generated Password: ${generatedPassword}\n`;
      confirmation += `Phone: ${session.trainerFormData.phone}\n`;
      confirmation += `Experience: ${session.trainerFormData.experience} years\n`;
      confirmation += `Specialization: ${session.trainerFormData.specialization}\n`;
      confirmation += `A welcome email with login credentials has been sent to the trainer.`;

      // Reset session
      session.adminStep = "dashboard";
      const formData = session.trainerFormData;
      session.trainerFormData = null;
      sessionStore.set(visitorId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [confirmation], // Single message with the entire confirmation
        suggestions: [
          "➕ Add Member",
          "🏋️ Add Trainer",
          "🔑 Add Admin",
          "💳 Add New Membership",
          "⏰ Expiring Members",
          "📊 View Reports",
        ],
      });
    } catch (error) {
      console.error("🔥 [ADMIN] Error saving trainer to database:", error);

      // Handle duplicate email error
      if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "This email is already registered. Please use a different email address.",
          ],
        });
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message
        );
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "Validation error:",
            ...validationErrors,
            "Please correct the errors and try again.",
          ],
        });
      }

      // Handle other errors
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Sorry, there was an error creating the trainer. Please try again later.",
        ],
      });
    }
  }

  session.adminStep = "dashboard";
  sessionStore.set(visitorId, session);
  return showAdminDashboard(res, session, visitorId);
}

// ----------------------- Add Admin Flow -----------------------
async function handleAddAdmin(message, res, session, visitorId) {
  // Initialize form data if not exists
  if (!session.adminData) {
    session.adminData = {};
    sessionStore.set(visitorId, session);
  }

  // Step 1: Name
  if (session.adminStep === "addAdmin_name") {
    if (!message) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter the admin's full name:"],
        input: {
          type: "name",
          placeholder: "Enter admin's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Handle different response formats from Zoho
    let nameValue = message;
    if (message && typeof message === "object" && message.value) {
      nameValue = message.value;
    }

    // Validate name
    if (!nameValue || nameValue.trim().length < 2) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["Please enter a valid name (at least 2 characters):"],
        input: {
          type: "name",
          placeholder: "Enter admin's full name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
      });
    }

    // Store name and move to next step
    session.adminData.name = nameValue;
    session.adminStep = "addAdmin_email";
    sessionStore.set(visitorId, session);

    // Show email input
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter the admin's email:"],
      input: {
        type: "email",
        name: "email",
        placeholder: "admin@example.com",
        label: "Email Address",
        mandatory: true,
      },
    });
  }

  // Step 2: Email
  if (session.adminStep === "addAdmin_email") {
    // Validate email
    if (!validateEmail(message)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "That doesn't look like a valid email. Please enter a valid email address:",
        ],
        input: {
          type: "email",
          name: "email",
          placeholder: "admin@example.com",
          label: "Email Address",
          mandatory: true,
        },
      });
    }

    // Check if email already exists
    try {
      const existingUser = await User.findOne({ email: message });
      if (existingUser) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "This email is already registered. Please use a different email address:",
          ],
          input: {
            type: "email",
            name: "email",
            placeholder: "admin@example.com",
            label: "Email Address",
            mandatory: true,
          },
        });
      }
    } catch (error) {
      console.error("🔥 [ADMIN] Error checking email:", error);
    }

    // Store email and move to next step
    session.adminData.email = message;
    session.adminStep = "addAdmin_phone";
    sessionStore.set(visitorId, session);

    // Show phone input
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Please enter the admin's phone number (with or without country code):",
      ],
      input: {
        type: "tel",
        name: "phone",
        placeholder: "9876543210",
        label: "Phone Number",
        mandatory: true,
      },
    });
  }

  // Step 3: Phone Number
  if (session.adminStep === "addAdmin_phone") {
    // Clean the phone number by removing all non-digit characters
    const cleanPhone = message.replace(/\D/g, "");

    // Remove '91' country code if present at the beginning
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
      finalPhone = cleanPhone.substring(2);
    }

    // Phone validation (exactly 10 digits after cleaning)
    const phoneRegex = /^\d{10}$/;

    if (!phoneRegex.test(finalPhone)) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Please enter a valid 10-digit phone number (with or without country code):",
        ],
        input: {
          type: "tel",
          name: "phone",
          placeholder: "9876543210",
          label: "Phone Number",
          mandatory: true,
        },
      });
    }

    // Store phone and move to next step
    session.adminData.phone = finalPhone; // Store clean phone number
    sessionStore.set(visitorId, session);

    // Save to database
    try {
      // Generate a random password
      const generatedPassword = generateRandomPassword(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Get current date for feePaidDate
      const currentDate = new Date();

      // Create new admin with the form data
      const newAdmin = new User({
        username: session.adminData.name,
        email: session.adminData.email,
        password: hashedPassword,
        role: "admin",
        phone: session.adminData.phone,
        feePaidDate: currentDate,
        firstLogin: true,
        addedBy: "admin",
      });

      // Save the admin to the database
      const savedAdmin = await newAdmin.save();

      // Send welcome email with credentials
      const emailData = {
        username: session.adminData.name,
        email: session.adminData.email,
        phone: session.adminData.phone,
      };

      // Send email in the background without waiting
      sendWelcomeEmail(emailData, generatedPassword, "admin")
        .then((emailResult) => {})
        .catch((emailError) => {
          console.error("🔥 [ADMIN] Error sending welcome email:", emailError);
        });

      // Prepare confirmation as a single string
      let confirmation = `✅ Admin ${session.adminData.name} has been added successfully!\n`;
      confirmation += `Email: ${session.adminData.email}\n`;
      confirmation += `Generated Password: ${generatedPassword}\n`;
      confirmation += `Phone: ${session.adminData.phone}\n`;
      confirmation += `A welcome email with login credentials has been sent to the admin.`;

      // Reset session
      session.adminStep = "dashboard";
      const formData = session.adminData;
      session.adminData = null;
      sessionStore.set(visitorId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [confirmation], // Single message with the entire confirmation
        suggestions: [
          "➕ Add Member",
          "🏋️ Add Trainer",
          "🔑 Add Admin",
          "💳 Add New Membership",
          "⏰ Expiring Members",
          "📊 View Reports",
        ],
      });
    } catch (error) {
      console.error("🔥 [ADMIN] Error saving admin to database:", error);

      // Handle duplicate email error
      if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "This email is already registered. Please use a different email address.",
          ],
        });
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message
        );
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "Validation error:",
            ...validationErrors,
            "Please correct the errors and try again.",
          ],
        });
      }

      // Handle other errors
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Sorry, there was an error creating the admin. Please try again later.",
        ],
      });
    }
  }

  // Fallback

  session.adminStep = "dashboard";
  sessionStore.set(visitorId, session);
  return showAdminDashboard(res, session, visitorId);
}

// ----------------------- Helper Functions -----------------------
function validateEmail(email) {
  // simple email validation
  const re = /\S+@\S+\.\S+/;
  const isValid = re.test(email);

  return isValid;
}

// Helper function to calculate membership expiry date
function calculateMembershipExpiry(period) {
  const expiryDate = new Date();

  if (period.includes("Month")) {
    const months = parseInt(period);
    expiryDate.setMonth(expiryDate.getMonth() + months);
  } else if (period.includes("Year")) {
    const years = parseInt(period);
    expiryDate.setFullYear(expiryDate.getFullYear() + years);
  }

  return expiryDate;
}

// ----------------------- Trainer Selection -----------------------
async function showTrainerSelection(res, session, visitorId) {
  try {
    // Fetch all trainers from the database
    const trainers = await Trainer.find();

    if (trainers.length === 0) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "No trainers available at the moment. Please add trainers first.",
        ],
        suggestions: ["🏋️ Add Trainer", "⬅️ Back to Dashboard"],
      });
    }

    // Format trainers for selection dropdown
    const trainerOptions = trainers.map((trainer) => ({
      text: `${trainer.name} - ${trainer.specialization}`,
      value: trainer._id.toString(),
    }));

    // Store trainers in session for later use
    session.trainersData = trainers;
    sessionStore.set(visitorId, session);

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please select a trainer:"],
      input: {
        type: "select",
        name: "trainer_selection",
        label: "Select Trainer",
        placeholder: "Choose a trainer",
        mandatory: true,
        options: trainerOptions,
      },
    });
  } catch (error) {
    console.error("🔥 [ADMIN] Error fetching trainers:", error);
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Error fetching trainers. Please try again later."],
      suggestions: ["🏋️ Add Trainer", "⬅️ Back to Dashboard"],
    });
  }
}

// ----------------------- Add Member to Database -----------------------
async function addMemberToDatabase(
  res,
  session,
  visitorId,
  additionalMessage = ""
) {
  try {
    // Generate a temporary password
    const tempPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Calculate membership expiry date
    const membershipExpiryDate = calculateMembershipExpiry(
      session.memberFormData.membership_period
    );

    // Get current date for feePaidDate
    const currentDate = new Date();

    // Create new user
    const newUser = new User({
      username: session.memberFormData.name,
      email: session.memberFormData.email,
      password: hashedPassword,
      role: "user",
      dateOfBirth: new Date(session.memberFormData.dob),
      phone: session.memberFormData.phone,
      membershipPlan: session.memberFormData.membership_type,
      trainerAssigned: session.memberFormData.trainerAssigned, // Use the enum value
      assignedTrainerId: session.memberFormData.trainer_id, // Store the trainer ID
      feeStatus: "Paid",
      feePaidDate: currentDate,
      membershipExpiryDate: membershipExpiryDate,
      firstLogin: true,
      addedBy: "admin",
    });

    // Save the user
    const savedUser = await newUser.save();

    // Send welcome email with credentials
    const emailData = {
      username: session.memberFormData.name,
      email: session.memberFormData.email,
      dateOfBirth: session.memberFormData.dob,
      phone: session.memberFormData.phone,
      membership_name: session.memberFormData.membership_name,
      membership_period: session.memberFormData.membership_period,
      personal_trainer: session.memberFormData.personal_trainer,
      trainerAssigned: session.memberFormData.trainerAssigned,
      membershipExpiryDate: membershipExpiryDate,
    };

    // Send email in the background without waiting
    sendWelcomeEmail(emailData, tempPassword, "user")
      .then((emailResult) => {
        console.log("🔥 [ADMIN] Welcome email result:", emailResult);
      })
      .catch((emailError) => {
        console.error("🔥 [ADMIN] Error sending welcome email:", emailError);
      });

    // Get trainer name for confirmation message
    let trainerName = "Self";
    if (
      session.memberFormData.personal_trainer &&
      session.memberFormData.trainer_id
    ) {
      try {
        const trainer = await Trainer.findById(
          session.memberFormData.trainer_id
        );
        if (trainer) {
          trainerName = trainer.name;
        }
      } catch (error) {
        console.error("🔥 [ADMIN] Error fetching trainer:", error);
      }
    }

    // Prepare confirmation as a single string
    let confirmation = `✅ Member ${session.memberFormData.name} has been added successfully!\n`;
    confirmation += `Email: ${session.memberFormData.email}\n`;
    confirmation += `Generated Password: ${tempPassword}\n`;
    confirmation += `Date of Birth: ${session.memberFormData.dob}\n`;
    confirmation += `Phone: ${session.memberFormData.phone}\n`;
    confirmation += `Membership: ${session.memberFormData.membership_name}\n`;
    confirmation += `Period: ${session.memberFormData.membership_period}\n`;
    confirmation += `Price: ${session.memberFormData.membership_price} INR\n`;
    confirmation += `Personal Training: ${
      session.memberFormData.personal_trainer ? "Yes" : "No"
    }\n`;
    confirmation += `Includes Personal Training: ${
      session.memberFormData.includesPersonalTraining ? "Yes" : "No"
    }\n`;
    confirmation += `Trainer Assigned: ${trainerName}\n`;
    confirmation += `Fee Paid Date: ${currentDate.toLocaleDateString()}\n`;
    confirmation += `Membership Expiry: ${membershipExpiryDate.toLocaleDateString()}\n`;
    confirmation += `A welcome email with login credentials has been sent to the member.`;

    // Add additional message if provided
    if (additionalMessage) {
      confirmation += `\n${additionalMessage}`;
    }

    // Reset session
    session.adminStep = "dashboard";
    session.memberFormData = null;
    session.plansData = null;
    session.trainersData = null;
    sessionStore.set(visitorId, session);

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [confirmation], // Single message with the entire confirmation
      suggestions: [
        "➕ Add Member",
        "🏋️ Add Trainer",
        "🔑 Add Admin",
        "💳 Add New Membership",
        "⏰ Expiring Members",
        "📊 View Reports",
      ],
    });
  } catch (error) {
    console.error("🔥 [ADMIN] Error saving user to database:", error);

    // Handle duplicate email error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "This email is already registered. Please use a different email address.",
        ],
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "Validation error:",
          ...validationErrors,
          "Please correct the errors and try again.",
        ],
      });
    }

    // Handle other errors
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Sorry, there was an error creating the member. Please try again later.",
      ],
    });
  }
}
