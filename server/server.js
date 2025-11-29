const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");

// ✅ CRITICAL FIX: Load dotenv ONCE at the very top, before any other imports
// In production (Render), this will do nothing because env vars are already set by Render
// In development, this will load from .env file
require("dotenv").config();

// ✅ Now import everything else AFTER dotenv is configured
const database = require("./database/db");
const { setupSocket } = require("./utils/messageSocket");
const UserRouter = require("./routes/login-registor-routes");
const AdminRouter = require("./routes/admin-route");
const trainerRoutes = require("./routes/trainer-route");
const planRoutes = require("./routes/plan-route");
const AdminRoutes = require("./routes/admin-management-route");
const analyticsRoutes = require("./routes/dashboard-route");
const userRoutes = require("./routes/user-routes");
const trainerPanelRoutes = require("./routes/trainerPanel-routes");
const { setupMembershipReminderJob } = require("./cron/membershipReminder");
const contactRoutes = require("./routes/contact-route");
const messageRoutes = require("./routes/message-routes");
const googleCalendarController = require("./controllers/googleCalendarController");
const zobotRoutes = require("./routes/zobotRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");

// ✅ Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const app = express();

// ✅ Connect to database
database();

// ✅ Initialize Google Calendar with better error handling
(async () => {
  try {
    // Check if Google Calendar credentials exist
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn(
        "⚠️ [GOOGLE CALENDAR] OAuth credentials not configured - Google Calendar integration disabled"
      );
      console.warn(
        "   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable"
      );
      return;
    }

    await googleCalendarController.initialize();
    console.log("✅ [GOOGLE CALENDAR] Successfully initialized");
  } catch (error) {
    console.error("❌ [GOOGLE CALENDAR] Initialization failed:", error.message);
    console.warn("⚠️ Google Calendar features will be unavailable");
    // Don't crash the server - just log the error
  }
})();

const server = http.createServer(app);
setupSocket(server);

// ✅ CORS configuration
app.use(
  cors({
    origin: ["https://gymstack-zobot.onrender.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// ✅ Payment routes
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: "Amount is required" });

    const options = {
      amount: amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/api/payment/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing fields" });
  }

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    return res.json({ verified: true });
  } else {
    return res.status(400).json({ verified: false });
  }
});

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      hasMongoUri: !!process.env.MONGODB_URI,
      hasEmailConfig: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      hasGoogleCalendarConfig: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      hasRazorpayConfig: !!(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ),
    },
    googleCalendar: {
      configured: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      initialized: googleCalendarController.initialized || false,
    },
    email: {
      configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    },
  });
});

// ✅ Debug endpoints
app.get("/webhook/debug-sessions", (req, res) => {
  const sessionStore = require("./utils/sessionStore");
  res.json({
    timestamp: new Date().toISOString(),
    sessionCount: sessionStore.getSessionCount(),
    sessions: sessionStore.listSessions(),
  });
});

app.post("/webhook/clear-session/:conversationId", (req, res) => {
  const sessionStore = require("./utils/sessionStore");
  const { conversationId } = req.params;

  const cleared = sessionStore.clear(conversationId);

  res.json({
    success: cleared,
    message: cleared
      ? `Session ${conversationId} cleared`
      : `Session ${conversationId} not found`,
  });
});

// ✅ API routes
app.use("/api/users", UserRouter);
app.use("/api/admin", AdminRouter);
app.use("/api/trainers", trainerRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/admins", AdminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/trainerProfile", trainerPanelRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/messages", messageRoutes);
app.use("/webhook/test", zobotRoutes);
app.use("/api/google", googleAuthRoutes);

// ✅ Setup cron job
setupMembershipReminderJob();

// ✅ Serve frontend
const clientPath = path.join(__dirname, "..", "client", "client", "dist");
app.use(express.static(clientPath));

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     🏋️  GYM MANAGEMENT SYSTEM SERVER          ║
╠════════════════════════════════════════════════╣
║  ✅ Server running on port ${PORT}               ║
║  ✅ Environment: ${process.env.NODE_ENV || "development"}        ║
║  ✅ Email configured: ${
    !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) ? "Yes" : "No"
  }            ║
║  ✅ Google Calendar: ${
    !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      ? "Yes"
      : "No"
  }             ║
║                                                ║
║  📅 Google Calendar Integration:               ║
║     Connect: ${
    process.env.GOOGLE_REDIRECT_URI
      ? process.env.GOOGLE_REDIRECT_URI.replace("/callback", "/auth")
      : "Not configured"
  }  ║
║     Status:  /api/google/status                ║
╚════════════════════════════════════════════════╝
  `);
});
