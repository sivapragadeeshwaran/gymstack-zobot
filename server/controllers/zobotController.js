const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const adminController = require("./zobotadminController");
const trainerController = require("./zobottrainerController");
const memberController = require("./zobotmemberController");
const newVisitorController = require("./NewVisitorController"); // Import the new controller

// Welcome image URL - replace with your actual image URL
const WELCOME_IMAGE_URL =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOapmKhjiQxHZFrsTNCAuXciuQ8kJZT4E2wQ&s";

// Welcome video URL - replace with your actual video URL
const WELCOME_VIDEO_URL = "https://www.youtube.com/watch?v=tUykoP30Gb0";

exports.handleZobot = async (req, res) => {
  console.log("🔥 Incoming Zobot Payload:");
  console.log(JSON.stringify(req.body, null, 2));

  // ----------------------------------------
  // 1️⃣ Create session identifier (visitorId or email-based fallback)
  // ----------------------------------------
  const visitorId =
    req.body.visitor?.active_conversation_id || req.body.visitor?.id;
  const email = req.body.visitor?.email;

  // Use email as fallback identifier if visitorId is missing
  const sessionId =
    visitorId || (email ? `email:${email}` : `temp:${Date.now()}`);

  if (!sessionId) {
    return res.json({
      action: "reply",
      replies: [
        {
          text: "👋 Welcome to Strength Zone Gym!\nPlease provide your email to get personalized assistance.",
          image: WELCOME_IMAGE_URL,
          image_position: "fit",
        },
        {
          type: "video",
          text: "Take a virtual tour of our state-of-the-art facility!",
          url: WELCOME_VIDEO_URL,
        },
      ],
    });
  }

  const msg = req.body.message?.text || "";

  // ----------------------------------------
  // 2️⃣ Load or create session
  // ----------------------------------------
  let session = sessionStore.get(sessionId) || { welcomeShown: false };

  // If session is new, initialize it
  if (!sessionStore.get(sessionId)) {
    session = { welcomeShown: false };
    sessionStore.set(sessionId, session);
  }

  // ----------------------------------------
  // NEW: Show welcome image and video if not shown yet
  // ----------------------------------------
  if (!session.welcomeShown) {
    // Update session to mark welcome as shown
    sessionStore.set(sessionId, { ...session, welcomeShown: true });

    return res.json({
      action: "reply",
      replies: [
        {
          text: "👋 Welcome to Strength Zone Gym! 💪\nHow can I assist you today?",
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

  // ----------------------------------------
  // 3️⃣ If already authenticated, route to appropriate controller
  // ----------------------------------------
  if (session.role) {
    switch (session.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "member":
      case "user":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        updateSession({ role: null, userId: null });
        return res.json({
          action: "reply",
          replies: ["Your role is not recognized. Please contact support."],
        });
    }
  }

  // ----------------------------------------
  // 4️⃣ Get email from visitor if not already available
  // ----------------------------------------
  if (!email) {
    // Route to new visitor controller if no email is available
    return newVisitorController.handleNewVisitor(msg, res, session, sessionId);
  }

  // ----------------------------------------
  // 5️⃣ Find user by email
  // ----------------------------------------
  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      // Route to new visitor controller if user is not found
      return newVisitorController.handleNewVisitor(
        msg,
        res,
        session,
        sessionId
      );
    }

    // ----------------------------------------
    // 6️⃣ Set session and route to appropriate controller
    // ----------------------------------------
    updateSession({
      stage: "dashboard",
      role: user.role,
      userId: user._id,
    });

    // Send initial greeting and route to controller
    const greetings = {
      admin: `👋 Welcome Admin ${user.username}! How can I assist you today?`,
      trainer: `💪 Hello Trainer ${user.username}! What would you like to manage?`,
      member: `🏋️ Hi ${user.username}! How can I help you with your fitness goals?`,
      user: `👤 Welcome ${user.username}! How can I assist you today?`,
    };

    // Route to appropriate controller based on role
    switch (user.role) {
      case "admin":
        return adminController.handleAdmin(msg, res, session, sessionId);
      case "trainer":
        return trainerController.handleTrainer(msg, res, session, sessionId);
      case "member":
      case "user":
        return memberController.handleMember(msg, res, session, sessionId);
      default:
        updateSession({ role: null, userId: null });
        return res.json({
          action: "reply",
          replies: [greetings.user],
        });
    }
  } catch (err) {
    console.error("❌ Error finding user:", err);
    // Route to new visitor controller in case of error
    return newVisitorController.handleNewVisitor(msg, res, session, sessionId);
  }
};
