const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const adminController = require("./zobotadminController");
const trainerController = require("./zobottrainerController");
const memberController = require("./zobotmemberController");
const newVisitorController = require("./NewVisitorController");

const WELCOME_IMAGE_URL =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOapmKhjiQxHZFrsTNCAuXciuQ8kJZT4E2wQ&s";
const WELCOME_VIDEO_URL = "https://www.youtube.com/watch?v=tUykoP30Gb0";

exports.handleZobot = async (req, res) => {
  console.log("🔥 Incoming Zobot Payload:");
  console.log(JSON.stringify(req.body, null, 2));

  // ========================================
  // 🔧 FIX #1: Use conversation_id ONLY as session identifier
  // ========================================
  const conversationId = req.body.visitor?.active_conversation_id;
  const visitorId = req.body.visitor?.id;

  if (!conversationId) {
    return res.json({
      action: "reply",
      replies: [
        {
          text: "👋 Welcome to Strength Zone Gym!\nPlease start a conversation to continue.",
          image: WELCOME_IMAGE_URL,
          image_position: "fit",
        },
      ],
    });
  }

  // Use conversationId as the PRIMARY session key
  const sessionId = conversationId;
  const msg = req.body.message?.text || "";

  // ========================================
  // 🔧 FIX #2: Check if this is a NEW conversation
  // ========================================
  let session = sessionStore.get(sessionId);

  // If no session exists for this conversation, it's NEW
  const isNewConversation = !session;

  if (isNewConversation) {
    // Fresh conversation - initialize clean session
    session = {
      welcomeShown: false,
      conversationId: conversationId,
      visitorId: visitorId,
      createdAt: Date.now(),
    };
    sessionStore.set(sessionId, session);

    console.log("✨ NEW CONVERSATION STARTED:", sessionId);
  }

  // ========================================
  // 🔧 FIX #3: Show welcome only for NEW conversations
  // ========================================
  if (!session.welcomeShown) {
    sessionStore.set(sessionId, { ...session, welcomeShown: true });

    return res.json({
      action: "reply",
      replies: [
        {
          text: "👋 Welcome to Strength Zone Gym! 💪\nPlease provide your email address to continue.",
          image: WELCOME_IMAGE_URL,
          image_position: "fit",
        },
        {
          type: "video",
          text: "Watch our intro video to see what makes Strength Zone Gym special!",
          url: WELCOME_VIDEO_URL,
        },
      ],
    });
  }

  const updateSession = (data) => {
    session = { ...session, ...data };
    sessionStore.set(sessionId, session);
  };

  // ========================================
  // 🔧 FIX #4: Handle "Edit Info" or reset request
  // ========================================
  const isResetRequest =
    msg.toLowerCase().includes("edit info") ||
    msg.toLowerCase().includes("change email") ||
    msg.toLowerCase().includes("update email") ||
    msg.toLowerCase().includes("logout") ||
    msg.toLowerCase().includes("reset") ||
    msg.toLowerCase().includes("start over");

  if (isResetRequest) {
    console.log("📝 User requested to reset - clearing authentication");

    // Clear role and authentication, but keep conversation
    updateSession({
      role: null,
      userId: null,
      email: null,
      authenticatedEmail: null,
      username: null,
      stage: null,
      isAuthenticated: false,
    });

    return res.json({
      action: "reply",
      replies: ["Please enter your email address:"],
    });
  }

  // ========================================
  // 🔧 FIX #5: Route ALREADY authenticated users to controllers
  // ========================================
  if (session.role && session.authenticatedEmail && session.isAuthenticated) {
    console.log(
      `🎯 Routing authenticated user to ${session.role} controller for email: ${session.authenticatedEmail}`
    );

    switch (session.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "member":
      case "user":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        updateSession({
          role: null,
          userId: null,
          email: null,
          isAuthenticated: false,
        });
        return res.json({
          action: "reply",
          replies: ["Your role is not recognized. Please contact support."],
        });
    }
  }

  // ========================================
  // 🔧 FIX #6: Extract email from message (NOT from Zoho visitor object)
  // ========================================
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = msg.match(emailRegex);

  let userEmail = null;

  if (emailMatch) {
    // User just provided email in THIS message
    userEmail = emailMatch[0].toLowerCase();
    console.log("📧 Email extracted from message:", userEmail);
  } else if (session.authenticatedEmail) {
    // Use previously authenticated email from THIS conversation
    userEmail = session.authenticatedEmail;
    console.log("📧 Using authenticated email from session:", userEmail);
  } else {
    // No email available - route to new visitor controller
    console.log("❓ No email found - routing to new visitor controller");
    return newVisitorController.handleNewVisitor(msg, res, session, sessionId);
  }

  // ========================================
  // 🔧 FIX #7: FRESH database lookup (no caching)
  // ========================================
  try {
    console.log("🔍 Querying database for email:", userEmail);

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log("❌ User not found for email:", userEmail);
      return newVisitorController.handleNewVisitor(
        msg,
        res,
        session,
        sessionId
      );
    }

    console.log("✅ User found:", {
      email: user.email,
      role: user.role,
      username: user.username,
    });

    // ========================================
    // 🔧 FIX #8: Store email ONLY after successful authentication
    // ========================================
    updateSession({
      stage: "authenticated",
      role: user.role,
      userId: user._id,
      authenticatedEmail: user.email, // Store the VERIFIED email
      username: user.username,
      isAuthenticated: true, // Mark as authenticated
    });

    console.log(`✅ Authentication successful - Role: ${user.role}`);

    // ========================================
    // 🔧 FIX #9: Send role-specific welcome message with menu
    // ========================================
    const welcomeMessages = {
      admin: {
        text: `👋 Welcome Admin ${user.username}!\n\nYou have access to:\n• Add New Member\n• Add New Trainer\n• Add New Admin\n• View Members\n• View Trainers\n• View Admins\n• Manage Plans\n\nWhat would you like to do?`,
        buttons: [
          { text: "Add Member", value: "add member" },
          { text: "Add Trainer", value: "add trainer" },
          { text: "View Members", value: "view members" },
          { text: "Manage Plans", value: "manage plans" },
        ],
      },
      trainer: {
        text: `💪 Hello Trainer ${user.username}!\n\nYou can:\n• View Your Schedule\n• View Assigned Members\n• Update Workout Plans\n• Mark Attendance\n\nWhat would you like to manage?`,
        buttons: [
          { text: "My Schedule", value: "my schedule" },
          { text: "My Members", value: "my members" },
          { text: "Update Plans", value: "update plans" },
        ],
      },
      member: {
        text: `🏋️ Hi ${user.username}!\n\nWelcome to your fitness journey!\n• View Your Workout Plan\n• Check Your Progress\n• View Schedule\n• Contact Trainer\n\nHow can I help you today?`,
        buttons: [
          { text: "My Workout", value: "my workout" },
          { text: "My Progress", value: "my progress" },
          { text: "Schedule", value: "my schedule" },
        ],
      },
    };

    const welcomeConfig = welcomeMessages[user.role] || welcomeMessages.member;

    // Return welcome message (NOT routing to controller yet)
    return res.json({
      action: "reply",
      replies: [welcomeConfig.text],
      suggestions: welcomeConfig.buttons,
    });

    // NOTE: Next message from user will be routed to appropriate controller
    // because session.isAuthenticated is now true
  } catch (err) {
    console.error("❌ Database error:", err);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error. Please try again or type 'reset' to start over.",
      ],
    });
  }
};
