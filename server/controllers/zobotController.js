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
  }

  const updateSession = (data) => {
    const updatedSession = { ...session, ...data };
    sessionStore.set(sessionId, updatedSession);
    session = updatedSession;

    console.log("📝 Session updated:", {
      conversationId: sessionId,
      role: updatedSession.role,
      email: updatedSession.authenticatedEmail,
      isAuthenticated: updatedSession.isAuthenticated,
    });

    return updatedSession;
  };

  // ✅ FIXED: Show welcome with email request immediately on first message
  if (!session.welcomeShown) {
    updateSession({ welcomeShown: true });

    return res.json({
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
    });
  }

  const isResetRequest =
    msg.toLowerCase().includes("edit info") ||
    msg.toLowerCase().includes("change email") ||
    msg.toLowerCase().includes("update email") ||
    msg.toLowerCase().includes("logout") ||
    msg.toLowerCase().includes("reset") ||
    msg.toLowerCase().includes("start over");

  if (isResetRequest) {
    console.log("📝 User requested to reset");

    updateSession({
      role: null,
      userId: null,
      email: null,
      authenticatedEmail: null,
      username: null,
      isAuthenticated: false,
      adminStep: null,
      trainerStep: null,
      memberStep: null,
    });

    return res.json({
      action: "reply",
      replies: ["Please enter your email address:"],
    });
  }

  // ✅ Route authenticated users to their role controllers
  if (session.isAuthenticated && session.role && session.authenticatedEmail) {
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
        updateSession({ role: null, userId: null, isAuthenticated: false });
        return res.json({
          action: "reply",
          replies: ["Your role is not recognized. Please contact support."],
        });
    }
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
      action: "reply",
      replies: ["Please provide a valid email address to continue:"],
    });
  }

  // ✅ Check if user exists in database
  try {
    console.log("🔍 Querying database for:", userEmail);

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log("❌ User not found - routing to new visitor");
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
          "🚨 Report an Issue",
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
          "⚠️ Report a Problem",
        ],
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
