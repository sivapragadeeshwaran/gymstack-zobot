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
    });

    return res.json({
      action: "reply",
      replies: ["Please enter your email address:"],
    });
  }

  // ========================================
  // 🔧 FIX #5: Route authenticated users
  // ========================================
  if (session.role && session.authenticatedEmail) {
    console.log(
      `🎯 Routing to ${session.role} controller for email: ${session.authenticatedEmail}`
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
        updateSession({ role: null, userId: null, email: null });
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
    // No email available - ask for it or route to new visitor
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
      stage: "dashboard",
      role: user.role,
      userId: user._id,
      authenticatedEmail: user.email, // Store the VERIFIED email
      username: user.username,
    });

    // Send role-specific greeting
    const greetings = {
      admin: `👋 Welcome Admin ${user.username}! How can I assist you today?`,
      trainer: `💪 Hello Trainer ${user.username}! What would you like to manage?`,
      member: `🏋️ Hi ${user.username}! How can I help you with your fitness goals?`,
      user: `👤 Welcome ${user.username}! How can I assist you today?`,
    };

    console.log(`✅ Authentication successful - Role: ${user.role}`);

    // Route to appropriate controller
    switch (user.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "member":
      case "user":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        updateSession({ role: null, userId: null, email: null });
        return res.json({
          action: "reply",
          replies: [greetings.user],
        });
    }
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
