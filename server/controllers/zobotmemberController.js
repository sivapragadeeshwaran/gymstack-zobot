const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const Plan = require("../Models/plan");
const Trainer = require("../Models/trainer-model");
const ClassSchedule = require("../Models/classSchedule");
const mongoose = require("mongoose");
const aiAssistantController = require("./aiAssistantController");
const problemReportController = require("./problemReportController"); // Import the problem report controller

exports.handleMember = (message, res, session, visitorId) => {
  // Initialize member session if not already done
  if (!session.memberStep) {
    session.memberStep = "dashboard";
    sessionStore.set(visitorId, session);
  }

  const msg = (message || "").toString().trim();

  // Handle "Back to Dashboard" at any point
  if (msg === "⬅️ Back to Dashboard") {
    session.memberStep = "dashboard";
    sessionStore.set(visitorId, session);
    return showMemberDashboard(res, session, visitorId);
  }

  // Handle dashboard navigation
  if (session.memberStep === "dashboard") {
    switch (msg) {
      case "📋 Membership Status":
        session.memberStep = "membership_status";
        sessionStore.set(visitorId, session);
        return handleMembershipStatus(msg, res, session, visitorId);
      case "💳 Renew Membership":
        session.memberStep = "renew_membership";
        sessionStore.set(visitorId, session);
        return handleRenewMembership(msg, res, session, visitorId);
      case "📅 Show Today's / Weekly Class":
        session.memberStep = "show_class";
        sessionStore.set(visitorId, session);
        return handleShowClass(msg, res, session, visitorId);
      case "👤 Update Profile":
        session.memberStep = "update_profile";
        sessionStore.set(visitorId, session);
        return handleUpdateProfile(msg, res, session, visitorId);
      case "📊 BMI Calculator":
        session.memberStep = "bmi_calculator";
        sessionStore.set(visitorId, session);
        return handleBMICalculator(msg, res, session, visitorId);
      case "🤖 Talk to AI Assistant":
        session.memberStep = "ai_assistant";
        sessionStore.set(visitorId, session);
        return handleAIAssistant(msg, res, session, visitorId);
      case "⚠️ Report a Problem":
        session.memberStep = "problem_report";
        sessionStore.set(visitorId, session);
        return problemReportController.handleProblemReport(
          msg,
          res,
          session,
          visitorId
        );
      default:
        return showMemberDashboard(res, session, visitorId);
    }
  }

  // Handle feature-specific steps
  switch (session.memberStep) {
    // Membership Status steps
    case "membership_status":
      return handleMembershipStatus(msg, res, session, visitorId);

    // Renew Membership steps
    case "renew_membership":
    case "renew_confirm":
    case "renew_select_plan":
    case "renew_confirm_payment":
    case "renew_upgrade_confirm":
      return handleRenewMembership(msg, res, session, visitorId);

    // Show Class steps
    case "show_class":
    case "class_schedule_type":
      return handleShowClass(msg, res, session, visitorId);

    // Update Profile steps
    case "update_profile":
    case "profile_field_select":
    case "profile_field_update":
    case "profile_update_confirm":
      return handleUpdateProfile(msg, res, session, visitorId);

    // BMI Calculator steps
    case "bmi_calculator":
    case "bmi_height":
    case "bmi_weight":
    case "bmi_gender":
      return handleBMICalculator(msg, res, session, visitorId);

    // AI Assistant steps
    case "ai_assistant":
      return handleAIAssistant(msg, res, session, visitorId);

    // Problem Report steps
    case "problem_report":
    case "problem_report_name":
    case "problem_report_email":
    case "problem_report_description":
    case "problem_report_confirm":
      return problemReportController.handleProblemReport(
        msg,
        res,
        session,
        visitorId
      );

    default:
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
  }
};

// ----------------------- Dashboard -----------------------
function showMemberDashboard(res, session, visitorId) {
  const greeting = `👋 Welcome ${
    session.username || "Member"
  }! How can I assist you today?`;

  const payload = {
    action: "reply",
    replies: [greeting],
    suggestions: [
      "📋 Membership Status",
      "💳 Renew Membership",
      "📅 Show Today's / Weekly Class",
      "👤 Update Profile",
      "📊 BMI Calculator",
      "🤖 Talk to AI Assistant",
    ],
  };

  // Make sure session step is dashboard
  session.memberStep = "dashboard";
  sessionStore.set(visitorId, session);

  return res.json(payload);
}

// ----------------------- Membership Status -----------------------
async function handleMembershipStatus(message, res, session, visitorId) {
  try {
    // Get user ID from session
    const userId = session.userId;
    if (!userId) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Fetch user details with membership plan
    const user = await User.findById(userId).populate("membershipPlan");
    if (!user) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate days left
    const membershipExpiryDate = new Date(user.membershipExpiryDate);
    const timeDiff = membershipExpiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Determine membership status
    const isActive = daysLeft > 0;
    const status = isActive ? "Active" : "Expired";

    // Format dates
    const joiningDate = new Date(user.feePaidDate).toLocaleDateString();
    const expiryDate = membershipExpiryDate.toLocaleDateString();

    // Prepare response as a single string
    let response = `📋 MEMBERSHIP STATUS\n\n`;
    response += `Plan Name: ${
      user.membershipPlan ? user.membershipPlan.name : "Unknown"
    }\n`;
    response += `Joining Date: ${joiningDate}\n`;
    response += `Expiry Date: ${expiryDate}\n`;
    response += `Amount Paid: ${
      user.membershipPlan ? user.membershipPlan.price + " INR" : "Unknown"
    }\n`;
    response += `Membership Status: ${status}\n`;
    response += `Days Left: ${isActive ? daysLeft : 0}\n\n`;

    // Add renewal option if expired or expiring soon
    if (!isActive || daysLeft <= 2) {
      response += `Your membership ${
        !isActive ? "has expired" : "expires soon"
      }. Would you like to renew it?`;

      session.memberStep = "renew_confirm";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
      });
    }

    // Reset session to dashboard
    session.memberStep = "dashboard";
    sessionStore.set(visitorId, session);

    return res.json({
      action: "reply",
      replies: [response],
      suggestions: [
        "📋 Membership Status",
        "💳 Renew Membership",
        "📅 Show Today's / Weekly Class",
        "👤 Update Profile",
        "📊 BMI Calculator",
        "🤖 Talk to AI Assistant",
      ],
    });
  } catch (error) {
    console.error("🔥 [MEMBER] Error fetching membership status:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving your membership status. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

// ----------------------- Renew Membership -----------------------
async function handleRenewMembership(message, res, session, visitorId) {
  try {
    // Handle "Back to Dashboard" at any point
    if (message === "⬅️ Back to Dashboard") {
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
    }

    // Get user ID from session
    const userId = session.userId;
    if (!userId) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Fetch user details with membership plan
    const user = await User.findById(userId).populate("membershipPlan");
    if (!user) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate days left
    const membershipExpiryDate = new Date(user.membershipExpiryDate);
    const timeDiff = membershipExpiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Handle renewal confirmation
    if (session.memberStep === "renew_confirm") {
      // Handle both "Yes" and "Renew Now" for consistency
      if (
        message === "✅ Yes" ||
        message === "Yes" ||
        message === "Renew Now"
      ) {
        // Show membership plans for renewal
        const plans = await Plan.find();

        if (plans.length === 0) {
          return res.json({
            action: "reply",
            replies: [
              "Sorry, no membership plans are available at the moment. Please try again later.",
            ],
            suggestions: ["⬅️ Back to Dashboard"],
          });
        }

        // Format options for the select dropdown
        const options = plans.map((plan) => ({
          text: `${plan.name} - ${plan.period} (${plan.price} INR)`,
          value: plan._id.toString(),
        }));

        // Store plans in session for later use
        session.plansData = plans;
        session.memberStep = "renew_select_plan";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: ["Please select a membership plan to renew:"],
          input: {
            type: "select",
            name: "membership_plan",
            label: "Membership Plan",
            placeholder: "Choose membership plan",
            mandatory: true,
            options: options,
          },
        });
      } else if (message === "❌ No" || message === "No") {
        // Reset session to dashboard
        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);
        return showMemberDashboard(res, session, visitorId);
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option: Yes or No"],
          suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
        });
      }
    }

    // Handle plan selection
    if (session.memberStep === "renew_select_plan") {
      // Process the selected plan
      let planValue = message;
      let selectedPlan = null;

      // Handle different response formats from Zoho
      if (message && typeof message === "object" && message.value) {
        planValue = message.value;

        // Find the selected plan by ID
        selectedPlan = session.plansData.find(
          (plan) => plan._id.toString() === planValue
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

      // Validate that a plan is selected
      if (!selectedPlan) {
        return res.json({
          action: "reply",
          replies: ["Invalid membership plan selected. Please try again."],
          input: {
            type: "select",
            name: "membership_plan",
            label: "Membership Plan",
            placeholder: "Choose membership plan",
            mandatory: true,
            options: session.plansData.map((plan) => ({
              text: `${plan.name} - ${plan.period} (${plan.price} INR)`,
              value: plan._id.toString(),
            })),
          },
        });
      }

      // Store selected plan
      session.selectedPlan = selectedPlan;
      session.memberStep = "renew_confirm_payment";
      sessionStore.set(visitorId, session);

      // Show confirmation with payment link using Zoho SalesIQ links format
      const confirmation = `You have selected the ${selectedPlan.name} plan (${selectedPlan.period}) for ${selectedPlan.price} INR.\n\nPlease click the link below to complete your payment:`;

      // Create payment link widget using the exact Zoho SalesIQ format
      const paymentLinkWidget = {
        type: "links",
        text: `${selectedPlan.name} - ${selectedPlan.period}\n${selectedPlan.price} INR Only`,
        image:
          "https://media.istockphoto.com/id/1189999454/photo/man-in-the-gym-paying-with-digital-wallet.jpg?s=612x612&w=0&k=20&c=JKlBXC8EHcP7nhVlTiwgTlgCllAhCFNAnEPX7Fyoglc=",
        links: [
          {
            url: `${process.env.PAYMENT_LINK}`,
            text: "Click here to pay",
            icon: "http://zylker.com/help/home.png",
          },
        ],
      };

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [confirmation, paymentLinkWidget],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Handle payment confirmation step
    if (session.memberStep === "renew_confirm_payment") {
      // Reset session to dashboard
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
    }

    // Handle upgrade confirmation
    if (session.memberStep === "renew_upgrade_confirm") {
      if (message === "✅ Yes" || message === "Yes") {
        // Show membership plans for upgrade
        const plans = await Plan.find();

        if (plans.length === 0) {
          return res.json({
            action: "reply",
            replies: [
              "Sorry, no membership plans are available at the moment. Please try again later.",
            ],
            suggestions: ["⬅️ Back to Dashboard"],
          });
        }

        // Format options for the select dropdown
        const options = plans.map((plan) => ({
          text: `${plan.name} - ${plan.period} (${plan.price} INR)`,
          value: plan._id.toString(),
        }));

        // Store plans in session for later use
        session.plansData = plans;
        session.memberStep = "renew_select_plan";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: ["Please select a membership plan to upgrade to:"],
          input: {
            type: "select",
            name: "membership_plan",
            label: "Membership Plan",
            placeholder: "Choose membership plan",
            mandatory: true,
            options: options,
          },
        });
      } else if (message === "❌ No" || message === "No") {
        // Reset session to dashboard
        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);
        return showMemberDashboard(res, session, visitorId);
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option: Yes or No"],
          suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
        });
      }
    }

    // Initial renewal check
    if (daysLeft <= 2) {
      let response = `Your membership expires in ${daysLeft} day${
        daysLeft !== 1 ? "s" : ""
      }. Click below to renew.`;

      session.memberStep = "renew_confirm";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
      });
    } else {
      // Ask if they want to upgrade
      let response = `You still have ${daysLeft} days left on your membership. Do you want to upgrade your membership?`;

      session.memberStep = "renew_upgrade_confirm";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
      });
    }
  } catch (error) {
    console.error("🔥 [MEMBER] Error in renew membership:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error processing your renewal request. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

async function handleShowClass(message, res, session, visitorId) {
  try {
    // BACK TO DASHBOARD
    if (message === "⬅️ Back to Dashboard") {
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
    }

    // 1. FETCH USER (Member)
    const userId = session.userId;
    if (!userId) {
      return res.json({
        action: "reply",
        replies: ["Session error. Please login again."],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        action: "reply",
        replies: ["User not found. Please login again."],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // 2. CHECK MEMBERSHIP
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(user.membershipExpiryDate);

    if (expiry < today) {
      return res.json({
        action: "reply",
        replies: ["⛔ Your membership has expired. Please renew."],
        suggestions: ["💳 Renew Membership", "⬅️ Back to Dashboard"],
      });
    }

    // 3. CHECK TRAINER ASSIGNMENT
    if (!user.assignedTrainerId) {
      return res.json({
        action: "reply",
        replies: ["You are not assigned to any trainer. Please contact admin."],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // 4. FETCH TRAINER DETAILS
    // user.assignedTrainerId references Trainer._id
    let trainer = await Trainer.findById(user.assignedTrainerId);

    if (!trainer) {
      // Try to find any available trainer as fallback
      const fallbackTrainer = await Trainer.findOne();
      if (!fallbackTrainer) {
        return res.json({
          action: "reply",
          replies: ["No trainers available. Please contact admin."],
          suggestions: ["⬅️ Back to Dashboard"],
        });
      }

      trainer = fallbackTrainer;
      user.assignedTrainerId = fallbackTrainer._id;
      await user.save();
    }

    // CRITICAL: ClassSchedule.trainerId references Trainer.userId (not Trainer._id)
    // So we need to use trainer.userId to query ClassSchedule
    const classScheduleTrainerId = trainer.userId;

    // 5. Ask schedule type
    if (session.memberStep === "show_class") {
      // Store trainer info in session for next step
      session.trainerName = trainer.name;
      session.trainerUserId = trainer.userId.toString();
      session.memberStep = "class_schedule_type";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [`View classes for trainer ${trainer.name}:`],
        suggestions: [
          "📅 Today's Class",
          "📆 Weekly Schedule",
          "⬅️ Back to Dashboard",
        ],
      });
    }

    // 6. Fetch and display schedule
    if (session.memberStep === "class_schedule_type") {
      // Retrieve trainer info from session
      const trainerUserId = session.trainerUserId;
      const trainerName = session.trainerName;

      // TODAY'S CLASS
      if (message === "📅 Today's Class" || message === "Today's Class") {
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        const currentDay = days[today.getDay()];

        // Query using trainer.userId (which is stored in ClassSchedule.trainerId)
        const todayClasses = await ClassSchedule.find({
          trainerId: trainerUserId,
          day: currentDay,
        }).sort({ time: 1 });

        if (todayClasses.length > 0) {
          console.log(
            "🔥 [CLASS] Sample class:",
            JSON.stringify(todayClasses[0], null, 2)
          );
        }

        if (todayClasses.length === 0) {
          return res.json({
            action: "reply",
            replies: [
              `📅 No classes scheduled for today (${currentDay}).\n\n` +
                `Trainer: ${trainerName}\n\n` +
                `Check the weekly schedule to see all available classes.`,
            ],
            suggestions: ["📆 Weekly Schedule", "⬅️ Back to Dashboard"],
          });
        }

        let response = `📅 TODAY'S CLASSES — ${currentDay}\n\n`;
        response += `👨‍🏫 Trainer: ${trainerName}\n\n`;

        todayClasses.forEach((c, index) => {
          response += `${index + 1}. ${c.title}\n`;
          response += `   ⏰ ${c.time}\n`;
          if (c.note) response += `   📝 ${c.note}\n`;
          response += `\n`;
        });

        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [response],
          suggestions: [
            "📋 Membership Status",
            "💳 Renew Membership",
            "📅 Show Today's / Weekly Class",
            "👤 Update Profile",
            "📊 BMI Calculator",
            "🤖 Talk to AI Assistant",
          ],
        });
      }

      // WEEKLY SCHEDULE
      else if (
        message === "📆 Weekly Schedule" ||
        message === "Weekly Schedule"
      ) {
        // Query using trainer.userId (which is stored in ClassSchedule.trainerId)
        const allClasses = await ClassSchedule.find({
          trainerId: trainerUserId,
        }).sort({ time: 1 });

        if (allClasses.length > 0) {
          console.log(
            "🔥 [CLASS] Sample class:",
            JSON.stringify(allClasses[0], null, 2)
          );
        }

        if (allClasses.length === 0) {
          return res.json({
            action: "reply",
            replies: [
              `No classes scheduled for trainer ${trainerName}.\n\n` +
                `Please contact admin to set up class schedules.`,
            ],
            suggestions: ["⬅️ Back to Dashboard"],
          });
        }

        // Define week order
        const weekDays = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];

        // Group classes by day
        const grouped = {};
        allClasses.forEach((c) => {
          if (!grouped[c.day]) grouped[c.day] = [];
          grouped[c.day].push(c);
        });

        let response = `📅 WEEKLY SCHEDULE\n\n`;
        response += `👨‍🏄 Trainer: ${trainerName}\n\n`;

        weekDays.forEach((day) => {
          response += `⭐ ${day}:\n`;

          if (grouped[day] && grouped[day].length > 0) {
            grouped[day].forEach((c, index) => {
              response += `   ${index + 1}. ${c.title}\n`;
              response += `      ⏰ ${c.time}\n`;
              if (c.note) response += `      📝 ${c.note}\n`;
            });
          } else {
            response += `   • No classes scheduled\n`;
          }

          response += "\n";
        });

        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [response],
          suggestions: [
            "📋 Membership Status",
            "💳 Renew Membership",
            "📅 Show Today's / Weekly Class",
            "👤 Update Profile",
            "📊 BMI Calculator",
            "🤖 Talk to AI Assistant",
          ],
        });
      }

      // INVALID OPTION
      return res.json({
        action: "reply",
        replies: ["Please choose a valid option."],
        suggestions: [
          "📅 Today's Class",
          "📆 Weekly Schedule",
          "⬅️ Back to Dashboard",
        ],
      });
    }
  } catch (err) {
    console.error("🔥 [CLASS] ERROR:", err);
    console.error("🔥 [CLASS] ERROR Stack:", err.stack);
    return res.json({
      action: "reply",
      replies: ["Something went wrong fetching classes. Please try again."],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

// ----------------------- Update Profile -----------------------
async function handleUpdateProfile(message, res, session, visitorId) {
  try {
    // Handle "Back to Dashboard" at any point
    if (message === "⬅️ Back to Dashboard") {
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
    }

    // Get user ID from session
    const userId = session.userId;
    if (!userId) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Fetch user details
    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Display current profile data
    if (session.memberStep === "update_profile") {
      let profileInfo = `📋 CURRENT PROFILE\n\n`;
      profileInfo += `Email: ${user.email}\n`;
      profileInfo += `Phone: ${user.phone}\n`;
      profileInfo += `Date of Birth: ${new Date(
        user.dateOfBirth
      ).toLocaleDateString()}\n\n`;
      profileInfo += `Which field would you like to update?`;

      session.memberStep = "profile_field_select";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [profileInfo],
        suggestions: [
          "✉️ Email",
          "📞 Phone",
          "📅 Date of Birth",
          "⬅️ Back to Dashboard",
        ],
      });
    }

    // Handle field selection
    if (session.memberStep === "profile_field_select") {
      if (message === "✉️ Email" || message === "Email") {
        session.updateField = "email";
        session.memberStep = "profile_field_update";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: ["Please enter your new email address:"],
          input: {
            type: "email",
            name: "email",
            placeholder: "your.email@example.com",
            label: "Email Address",
            mandatory: true,
          },
        });
      } else if (message === "📞 Phone" || message === "Phone") {
        session.updateField = "phone";
        session.memberStep = "profile_field_update";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [
            "Please enter your new phone number (with or without country code):",
          ],
          input: {
            type: "tel",
            name: "phone",
            placeholder: "+91 9876543210",
            label: "Phone Number",
            mandatory: true,
          },
        });
      } else if (
        message === "📅 Date of Birth" ||
        message === "Date of Birth"
      ) {
        session.updateField = "dateOfBirth";
        session.memberStep = "profile_field_update";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: ["Please enter your new date of birth (YYYY-MM-DD):"],
        });
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid field to update:"],
          suggestions: [
            "✉️ Email",
            "📞 Phone",
            "📅 Date of Birth",
            "⬅️ Back to Dashboard",
          ],
        });
      }
    }

    // Handle field update
    if (session.memberStep === "profile_field_update") {
      const field = session.updateField;
      let newValue = message;
      let isValid = true;

      // Validate input based on field
      if (field === "email") {
        // Simple email validation
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(newValue)) {
          isValid = false;
        }
      } else if (field === "phone") {
        // Clean the phone number by removing all non-digit characters
        const cleanPhone = newValue.replace(/\D/g, "");

        // Remove '91' country code if present at the beginning
        let finalPhone = cleanPhone;
        if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
          finalPhone = cleanPhone.substring(2);
        }

        // Phone validation (exactly 10 digits after cleaning)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(finalPhone)) {
          isValid = false;
        } else {
          newValue = finalPhone;
        }
      } else if (field === "dateOfBirth") {
        // Validate DOB format (YYYY-MM-DD)
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(newValue)) {
          isValid = false;
        } else {
          // Additional validation to ensure it's a reasonable date
          const dateParts = newValue.split("-");
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]);
          const day = parseInt(dateParts[2]);
          const currentYear = new Date().getFullYear();

          // Basic validation for year (not in the future and not too far in the past)
          if (year > currentYear || year < currentYear - 120) {
            isValid = false;
          }

          // Basic validation for month (1-12)
          if (month < 1 || month > 12) {
            isValid = false;
          }

          // Basic validation for day (1-31)
          if (day < 1 || day > 31) {
            isValid = false;
          }
        }
      }

      if (!isValid) {
        return res.json({
          action: "reply",
          replies: ["Invalid input. Please enter a valid value:"],
          input:
            field === "email"
              ? {
                  type: "email",
                  name: "email",
                  placeholder: "your.email@example.com",
                  label: "Email Address",
                  mandatory: true,
                }
              : field === "phone"
              ? {
                  type: "tel",
                  name: "phone",
                  placeholder: "+91 9876543210",
                  label: "Phone Number",
                  mandatory: true,
                }
              : undefined,
        });
      }

      // Store new value and ask for confirmation
      session.newValue = newValue;
      session.memberStep = "profile_update_confirm";
      sessionStore.set(visitorId, session);

      const fieldDisplayName =
        field === "dateOfBirth"
          ? "Date of Birth"
          : field.charAt(0).toUpperCase() + field.slice(1);
      const displayValue =
        field === "dateOfBirth"
          ? new Date(newValue).toLocaleDateString()
          : newValue;

      return res.json({
        action: "reply",
        replies: [
          `You are about to update your ${fieldDisplayName} to: ${displayValue}\n\nDo you want to proceed?`,
        ],
        suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
      });
    }

    // Handle update confirmation
    if (session.memberStep === "profile_update_confirm") {
      if (message === "✅ Yes" || message === "Yes") {
        // Update user profile
        const field = session.updateField;
        const newValue = session.newValue;

        // Create update object
        const updateObj = {};
        updateObj[field] =
          field === "dateOfBirth" ? new Date(newValue) : newValue;

        // Update user in database
        await User.findByIdAndUpdate(userId, updateObj);

        // Reset session to dashboard
        session.memberStep = "dashboard";
        sessionStore.set(visitorId, session);

        const fieldDisplayName =
          field === "dateOfBirth"
            ? "Date of Birth"
            : field.charAt(0).toUpperCase() + field.slice(1);
        const displayValue =
          field === "dateOfBirth"
            ? new Date(newValue).toLocaleDateString()
            : newValue;

        return res.json({
          action: "reply",
          replies: [
            `✅ Your ${fieldDisplayName} has been updated to: ${displayValue}`,
          ],
          suggestions: [
            "📋 Membership Status",
            "💳 Renew Membership",
            "📅 Show Today's / Weekly Class",
            "👤 Update Profile",
            "📊 BMI Calculator",
            "🤖 Talk to AI Assistant",
          ],
        });
      } else if (message === "❌ No" || message === "No") {
        // Go back to field selection
        session.memberStep = "update_profile";
        sessionStore.set(visitorId, session);
        return handleUpdateProfile("", res, session, visitorId);
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option: Yes or No"],
          suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
        });
      }
    }
  } catch (error) {
    console.error("🔥 [MEMBER] Error in update profile:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error updating your profile. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

// ----------------------- BMI Calculator -----------------------
async function handleBMICalculator(message, res, session, visitorId) {
  try {
    // Handle "Back to Dashboard" at any point
    if (message === "⬅️ Back to Dashboard") {
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);
      return showMemberDashboard(res, session, visitorId);
    }

    // Get user ID from session
    const userId = session.userId;
    if (!userId) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your account. Please try logging in again.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    // Handle height input
    if (session.memberStep === "bmi_calculator") {
      session.memberStep = "bmi_height";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter your height in centimeters:"],
      });
    }

    // Handle height input
    if (session.memberStep === "bmi_height") {
      // Validate height
      if (
        !/^\d+$/.test(message) ||
        parseInt(message) < 50 ||
        parseInt(message) > 250
      ) {
        return res.json({
          action: "reply",
          replies: [
            "Please enter a valid height between 50 and 250 centimeters:",
          ],
        });
      }

      // Store height and move to weight input
      session.height = parseInt(message);
      session.memberStep = "bmi_weight";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter your weight in kilograms:"],
      });
    }

    // Handle weight input
    if (session.memberStep === "bmi_weight") {
      // Validate weight
      if (
        !/^\d+(\.\d+)?$/.test(message) ||
        parseFloat(message) < 20 ||
        parseFloat(message) > 300
      ) {
        return res.json({
          action: "reply",
          replies: [
            "Please enter a valid weight between 20 and 300 kilograms:",
          ],
        });
      }

      // Store weight and move to gender input
      session.weight = parseFloat(message);
      session.memberStep = "bmi_gender";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please select your gender:"],
        suggestions: ["👨 Male", "👩 Female", "⬅️ Back to Dashboard"],
      });
    }

    // Handle gender input and calculate BMI
    if (session.memberStep === "bmi_gender") {
      if (!["👨 Male", "👩 Female", "Male", "Female"].includes(message)) {
        return res.json({
          action: "reply",
          replies: ["Please select a valid gender:"],
          suggestions: ["👨 Male", "👩 Female", "⬅️ Back to Dashboard"],
        });
      }

      // Get height and weight from session
      const heightCm = session.height;
      const weightKg = session.weight;
      const gender = message.includes("Male") ? "Male" : "Female";

      // Convert height to meters
      const heightM = heightCm / 100;

      // Calculate BMI
      const bmi = weightKg / (heightM * heightM);

      // Determine BMI category based on gender
      let category = "";
      let advice = "";

      if (gender === "Male") {
        if (bmi < 18.5) {
          category = "Underweight";
          advice =
            "Consider consulting with a nutritionist to develop a healthy eating plan to gain weight.";
        } else if (bmi >= 18.5 && bmi <= 24.9) {
          category = "Normal";
          advice =
            "Great job! Maintain your current lifestyle with regular exercise and a balanced diet.";
        } else if (bmi >= 25 && bmi <= 29.9) {
          category = "Overweight";
          advice =
            "Consider incorporating more physical activity and a balanced diet to achieve a healthier weight.";
        } else {
          category = "Obese";
          advice =
            "It's recommended to consult with a healthcare professional for a comprehensive weight management plan.";
        }
      } else {
        // Female
        if (bmi < 18.0) {
          category = "Underweight";
          advice =
            "Consider consulting with a nutritionist to develop a healthy eating plan to gain weight.";
        } else if (bmi >= 18.0 && bmi <= 24.0) {
          category = "Normal";
          advice =
            "Great job! Maintain your current lifestyle with regular exercise and a balanced diet.";
        } else if (bmi >= 24.1 && bmi <= 29.0) {
          category = "Overweight";
          advice =
            "Consider incorporating more physical activity and a balanced diet to achieve a healthier weight.";
        } else {
          category = "Obese";
          advice =
            "It's recommended to consult with a healthcare professional for a comprehensive weight management plan.";
        }
      }

      // Prepare response
      let response = `📊 BMI CALCULATOR RESULTS\n\n`;
      response += `Height: ${heightCm} cm\n`;
      response += `Weight: ${weightKg} kg\n`;
      response += `Gender: ${gender}\n`;
      response += `BMI Value: ${bmi.toFixed(1)}\n`;
      response += `Category: ${category}\n\n`;
      response += `💡 Advice: ${advice}`;

      // Reset session to dashboard
      session.memberStep = "dashboard";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: [
          "📋 Membership Status",
          "💳 Renew Membership",
          "📅 Show Today's / Weekly Class",
          "👤 Update Profile",
          "📊 BMI Calculator",
          "🤖 Talk to AI Assistant",
        ],
      });
    }
  } catch (error) {
    console.error("🔥 [MEMBER] Error in BMI calculator:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error calculating your BMI. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

// ----------------------- AI Assistant -----------------------
function handleAIAssistant(message, res, session, visitorId) {
  // Delegate to the AI assistant controller
  return aiAssistantController.handleAIAssistant(
    message,
    res,
    session,
    visitorId
  );
}
