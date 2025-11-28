const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const database = require("./database/db");
const { setupSocket } = require("./utils/messageSocket");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

const path = require("path");
const zobotRoutes = require("./routes/zobotRoutes");

const googleAuthRoutes = require("./routes/googleAuthRoutes");

dotenv.config();

const app = express();
database();

(async () => {
  try {
    await googleCalendarController.initialize();
    console.log("✅ [STARTUP] Google Calendar initialized");
  } catch (error) {
    console.log("⚠️ [STARTUP] Google Calendar not connected:", error.message);
    console.log(
      "👉 [STARTUP] Connect at: http://localhost:5000/api/google/auth"
    );
  }
})();

const server = http.createServer(app);
setupSocket(server);

// ⭐ Correct CORS for cookies
app.use(
  cors({
    origin: ["https://gymstack-zobot.onrender.com"],
    methods: ["GET", "POST", "PUT", "DELETE"], // FIXED
    credentials: true,
  })
);

// ⭐ MUST enable cookie parser BEFORE routes
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

app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // amount in paise
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

// Verify Razorpay payment
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

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ⭐ Backend API routes
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

// ⭐ Zobot webhook (cookies are available here!)
app.use("/webhook/test", zobotRoutes);

app.use("/api/google", googleAuthRoutes);

// ⭐ Cron job
setupMembershipReminderJob();

// ⭐ Frontend serving
const clientPath = path.join(__dirname, "..", "client", "client", "dist");
app.use(express.static(clientPath));

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// ⭐ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     🏋️  GYM MANAGEMENT SYSTEM SERVER          ║
╠════════════════════════════════════════════════╣
║  ✅ Server running on port ${PORT}               ║
║  ✅ Environment: ${process.env.NODE_ENV || "development"}        ║
║                                                ║
║  📅 Google Calendar Integration:               ║
║     Connect: http://localhost:${PORT}/api/google/auth  ║
║     Status:  http://localhost:${PORT}/api/google/status║
╚════════════════════════════════════════════════╝
  `);
});
