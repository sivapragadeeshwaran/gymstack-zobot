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

  // Helper function to update session
  const updateSession = (data) => {
    session = { ...session, ...data };
    sessionStore.set(sessionId, session);
    console.log("📝 Session updated:", {
      role: session.role,
      stage: session.stage,
      isAuthenticated: session.isAuthenticated,
      email: session.authenticatedEmail,
    });
  };

  // ========================================
  // 🔧 FIX #3: Show welcome only for NEW conversations
  // ========================================
  if (!session.welcomeShown) {
    updateSession({ welcomeShown: true });

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
      stage: "awaiting_email",
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
  if (session.isAuthenticated && session.role && session.authenticatedEmail) {
    console.log(`🎯 Routing authenticated user to ${session.role} controller`);
    console.log(`📧 Email: ${session.authenticatedEmail}`);
    console.log(`💬 Message: ${msg}`);

    switch (session.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "user":
      case "member":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        console.log("❌ Unknown role:", session.role);
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
  } else if (!session.isAuthenticated) {
    // No email and not authenticated - route to new visitor controller
    console.log(
      "❓ No email found and not authenticated - routing to new visitor controller"
    );
    return newVisitorController.handleNewVisitor(msg, res, session, sessionId);
  } else {
    // Authenticated but no email in message - should not happen
    console.log("⚠️ Authenticated but no email - this should not happen");
    return res.json({
      action: "reply",
      replies: ["Something went wrong. Please type 'reset' to start over."],
    });
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
    // 🔧 FIX #8: Store COMPLETE user info after successful authentication
    // ========================================
    updateSession({
      stage: "dashboard",
      role: user.role,
      userId: user._id.toString(),
      authenticatedEmail: user.email,
      username: user.username,
      isAuthenticated: true,
      phone: user.phone,
      membershipPlan: user.membershipPlan,
      trainerAssigned: user.trainerAssigned,
      feeStatus: user.feeStatus,
    });

    console.log(`✅ Authentication successful - Role: ${user.role}`);

    // ========================================
    // 🔧 FIX #9: Send role-specific dashboard IMMEDIATELY
    // ========================================

    // Create role-specific dashboard messages
    if (user.role === "admin") {
      return res.json({
        action: "reply",
        replies: [
          `👋 Welcome Admin ${user.username}!\n\nAdmin Dashboard:`,
          {
            text: "What would you like to do?",
            input: {
              type: "select",
              options: [
                { title: "➕ Add New Member", value: "add member" },
                { title: "➕ Add New Trainer", value: "add trainer" },
                { title: "➕ Add New Admin", value: "add admin" },
                { title: "👥 View Members", value: "view members" },
                { title: "💪 View Trainers", value: "view trainers" },
                { title: "👨‍💼 View Admins", value: "view admins" },
                { title: "📋 Manage Plans", value: "manage plans" },
              ],
            },
          },
        ],
      });
    } else if (user.role === "trainer") {
      return res.json({
        action: "reply",
        replies: [
          `💪 Hello Trainer ${user.username}!\n\nTrainer Dashboard:`,
          {
            text: "What would you like to manage?",
            input: {
              type: "select",
              options: [
                { title: "📅 My Schedule", value: "my schedule" },
                { title: "👥 My Members", value: "my members" },
                { title: "📝 Update Plans", value: "update plans" },
                { title: "✅ Mark Attendance", value: "mark attendance" },
              ],
            },
          },
        ],
      });
    } else {
      // user or member role
      return res.json({
        action: "reply",
        replies: [
          `🏋️ Hi ${user.username}!\n\nMember Dashboard:`,
          {
            text: "How can I help you today?",
            input: {
              type: "select",
              options: [
                { title: "💪 My Workout Plan", value: "my workout" },
                { title: "📈 My Progress", value: "my progress" },
                { title: "📅 My Schedule", value: "my schedule" },
                { title: "👨‍🏫 Contact Trainer", value: "contact trainer" },
                { title: "💳 Membership Status", value: "membership status" },
              ],
            },
          },
        ],
      });
    }

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
