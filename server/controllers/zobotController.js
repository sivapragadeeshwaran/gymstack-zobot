const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const adminController = require("./zobotadminController");
const trainerController = require("./zobottrainerController");
const memberController = require("./zobotmemberController");
const newVisitorController = require("./NewVisitorController");

const WELCOME_IMAGE_URL =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOapmKhjiQxHZFrsTNCAuXciuQ8kJZT4E2wQ&s";
const WELCOME_VIDEO_URL = "https://www.youtube.com/watch?v=tUykoP30Gb0";

// 🔥 RECOMMENDED: 3 minutes for good user experience
// Users won't get interrupted, but inactive sessions clear quickly
const SESSION_TIMEOUT = 3 * 60 * 1000; // 3 minutes

exports.handleZobot = async (req, res) => {
  console.log("🔥 Incoming Zobot Payload:");
  console.log(JSON.stringify(req.body, null, 2));

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

  const sessionId = conversationId;
  const msg = req.body.message?.text || "";

  console.log("🔑 Session ID:", sessionId);
  console.log("💬 Message:", msg);

  let session = sessionStore.get(sessionId);

  console.log("📦 Current session:", session);

  const isNewConversation = !session;

  if (isNewConversation) {
    session = {
      welcomeShown: false,
      conversationId: conversationId,
      visitorId: visitorId,
      createdAt: Date.now(),
    };
    sessionStore.set(sessionId, session);
    console.log("✨ NEW CONVERSATION STARTED:", sessionId);
  } else {
    // 🔥 AUTO-RESET: Check session timeout and COMPLETELY reset if stale
    const inactiveTime =
      Date.now() - (session.lastAccessed || session.createdAt || 0);

    if (inactiveTime > SESSION_TIMEOUT) {
      console.log(
        `⚠️ Stale session detected (inactive > ${
          SESSION_TIMEOUT / 1000
        }s), AUTO-RESETTING...`
      );

      // Clear the session completely first
      sessionStore.clear(sessionId);

      // Create fresh session with NO old data
      session = {
        welcomeShown: false,
        conversationId: conversationId,
        visitorId: visitorId,
        createdAt: Date.now(),
      };
      sessionStore.set(sessionId, session);
      console.log("✨ AUTO-RESET COMPLETE:", sessionId);
    }
  }

  const updateSession = (data) => {
    const updatedSession = { ...session, ...data };
    sessionStore.set(sessionId, updatedSession);
    session = updatedSession;

    console.log("📝 Session updated:", {
      conversationId: sessionId,
      role: updatedSession.role,
      email: updatedSession.authenticatedEmail || updatedSession.email,
      isAuthenticated: updatedSession.isAuthenticated,
    });

    return updatedSession;
  };

  // ✅ Show welcome with email input field immediately on first message
  if (!session.welcomeShown) {
    // Clear ALL authentication and role data
    updateSession({
      welcomeShown: true,
      role: null,
      userId: null,
      email: null,
      authenticatedEmail: null,
      username: null,
      isAuthenticated: false,
      adminStep: null,
      trainerStep: null,
      memberStep: null,
      visitorStep: null,
      memberFormData: null,
      trainerFormData: null,
      adminData: null,
      membershipData: null,
      classScheduleData: null,
      contactName: null,
      contactEmail: null,
      contactSubject: null,
      contactMessage: null,
    });

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        {
          text: "👋 Welcome to Strength Zone Gym! 💪",
          image: WELCOME_IMAGE_URL,
          image_position: "fit",
        },
        {
          type: "video",
          text: "Watch our intro video to see what makes Strength Zone Gym special!",
          url: WELCOME_VIDEO_URL,
        },
        {
          text: "Please provide your email address to continue:",
        },
      ],
      input: {
        type: "email",
        placeholder: "Enter your email address",
        value: "",
        error: ["Enter a valid email address"],
      },
    });
  }

  // 🔥 ENHANCED: Handle manual reset requests with better keywords
  const msgLower = msg.toLowerCase().trim();
  const isResetRequest =
    msgLower === "reset" ||
    msgLower === "logout" ||
    msgLower === "start over" ||
    msgLower === "new session" ||
    msgLower === "change email" ||
    msgLower === "edit info" ||
    msgLower === "update email" ||
    msgLower === "switch user" ||
    msgLower === "change user";

  if (isResetRequest) {
    console.log("📝 User requested MANUAL RESET");

    // Clear session completely, then create fresh one
    sessionStore.clear(sessionId);

    session = {
      welcomeShown: false,
      conversationId: conversationId,
      visitorId: visitorId,
      createdAt: Date.now(),
    };
    sessionStore.set(sessionId, session);

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "🔄 Session reset! Please enter your email address to continue:",
      ],
      input: {
        type: "email",
        placeholder: "Enter your email address",
        value: "",
        error: ["Enter a valid email address"],
      },
    });
  }

  // 🔥 ENHANCED: Validate authentication state BEFORE routing
  if (session.isAuthenticated && session.role && session.authenticatedEmail) {
    // Verify user still exists in database
    try {
      const user = await User.findById(session.userId);

      if (!user || user.email !== session.authenticatedEmail) {
        console.log(
          "⚠️ Authenticated user not found or email mismatch - AUTO-RESETTING"
        );

        sessionStore.clear(sessionId);
        session = {
          welcomeShown: false,
          conversationId: conversationId,
          visitorId: visitorId,
          createdAt: Date.now(),
        };
        sessionStore.set(sessionId, session);

        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: [
            "⚠️ Your session has expired. Please enter your email address:",
          ],
          input: {
            type: "email",
            placeholder: "Enter your email address",
            value: "",
            error: ["Enter a valid email address"],
          },
        });
      }
    } catch (err) {
      console.error("❌ Error verifying user:", err);
      // On error, reset session to be safe
      sessionStore.clear(sessionId);
      session = {
        welcomeShown: false,
        conversationId: conversationId,
        visitorId: visitorId,
        createdAt: Date.now(),
      };
      sessionStore.set(sessionId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["❌ Session error. Please enter your email address:"],
        input: {
          type: "email",
          placeholder: "Enter your email address",
          value: "",
          error: ["Enter a valid email address"],
        },
      });
    }

    // ✅ Route authenticated users to their role controllers
    console.log(`✅ User authenticated, routing to ${session.role} controller`);

    switch (session.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "user":
      case "member":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        // Reset session on invalid role
        sessionStore.clear(sessionId);
        session = {
          welcomeShown: false,
          conversationId: conversationId,
          visitorId: visitorId,
          createdAt: Date.now(),
        };
        sessionStore.set(sessionId, session);

        return res.json({
          action: "reply",
          replies: [
            "⚠️ Your role is not recognized. Please enter your email address:",
          ],
          input: {
            type: "email",
            placeholder: "Enter your email address",
            value: "",
            error: ["Enter a valid email address"],
          },
        });
    }
  }

  // ✅ Check if user is already identified as new visitor
  if (session.role === "new_visitor" && session.email) {
    console.log("✅ Routing to new visitor controller");
    return newVisitorController.handleNewVisitor(msg, res, session, sessionId);
  }

  // ✅ Extract email from user message
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = msg.match(emailRegex);

  let userEmail = null;

  if (emailMatch) {
    userEmail = emailMatch[0].toLowerCase();
    console.log("📧 Email extracted:", userEmail);
  } else {
    console.log("❓ No email found, asking for it");

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please provide a valid email address to continue:"],
      input: {
        type: "email",
        placeholder: "Enter your email address",
        value: "",
        error: ["Enter a valid email address"],
      },
    });
  }

  // ✅ Check if user exists in database
  try {
    console.log("🔍 Querying database for:", userEmail);

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log("❌ User not found - routing to new visitor");

      updateSession({
        role: "new_visitor",
        email: userEmail,
      });

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

    // ✅ Update session with user data and mark as authenticated
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
      adminStep: user.role === "admin" ? "dashboard" : null,
      trainerStep: user.role === "trainer" ? "dashboard" : null,
      memberStep: user.role === "user" ? "dashboard" : null,
    });

    console.log(`✅ Authentication successful - Role: ${user.role}`);

    // ✅ Send appropriate dashboard based on user role
    if (user.role === "admin") {
      console.log("✅ Sending ADMIN dashboard");
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [`👋 Welcome Admin ${user.username}! Here's your dashboard:`],
        suggestions: [
          "➕ Add Member",
          "🏋️ Add Trainer",
          "🔑 Add Admin",
          "💳 Add New Membership",
          "⏰ Expiring Members",
          "📊 View Reports",
        ],
      });
    } else if (user.role === "trainer") {
      console.log("✅ Sending TRAINER dashboard");
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [`👋 Welcome ${user.username}! How can I assist you today?`],
        suggestions: [
          "👥 View Members",
          "📝 Update Profile",
          "📅 Add Class Schedule",
          "🤖 Talk to AI Assistant",
        ],
      });
    } else {
      console.log("✅ Sending MEMBER dashboard");
      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [`👋 Welcome ${user.username}! How can I assist you today?`],
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
  } catch (err) {
    console.error("❌ Database error:", err);
    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        "Sorry, there was an error. Please try again or type 'reset' to start over.",
      ],
      input: {
        type: "email",
        placeholder: "Enter your email address",
        value: "",
        error: ["Enter a valid email address"],
      },
    });
  }
};

// Endpoint for conversation end (in case you want to use it later)
exports.handleConversationEnd = async (req, res) => {
  console.log("🔚 Conversation ended - Clearing session");
  console.log(JSON.stringify(req.body, null, 2));

  const conversationId =
    req.body.conversation?.id || req.body.visitor?.active_conversation_id;

  if (conversationId) {
    console.log(`🗑️ Clearing session for conversation: ${conversationId}`);
    sessionStore.clear(conversationId);

    return res.json({
      success: true,
      message: "Session cleared successfully",
    });
  }

  return res.json({
    success: false,
    message: "No conversation ID found",
  });
};
