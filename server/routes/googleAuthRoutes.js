// routes/googleAuthRoutes.js
const express = require("express");
const router = express.Router();
const { oauth2Client } = require("../config/googleOAuth");
const tokenService = require("../services/tokenService");
const googleCalendarController = require("../controllers/googleCalendarController");

// ✅ Step 1: Redirect to Google OAuth consent screen
router.get("/auth", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // Get refresh token
    scope: [
      "https://www.googleapis.com/auth/calendar", // Full calendar access
      "https://www.googleapis.com/auth/calendar.events", // Calendar events
    ],
    prompt: "consent", // Force consent screen to get refresh token
  });

  res.redirect(authUrl);
});

// ✅ Step 2: Handle OAuth callback from Google
router.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    console.error("❌ [GOOGLE AUTH] No authorization code received");
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #f44336;">❌ Authorization Failed</h1>
          <p>No authorization code received from Google.</p>
          <a href="/api/google/auth" style="color: #2196F3;">Try Again</a>
        </body>
      </html>
    `);
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens
    await tokenService.saveTokens(tokens);

    // Set credentials for immediate use
    oauth2Client.setCredentials(tokens);

    // Initialize the calendar controller
    await googleCalendarController.initialize();

    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              color: #333;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              max-width: 500px;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            .details {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
              text-align: left;
            }
            .details p { margin: 10px 0; }
            button {
              background: #4CAF50;
              color: white;
              border: none;
              padding: 12px 30px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Google Calendar Connected!</h1>
            <p>Your gym management system is now integrated with Google Calendar.</p>
            <div class="details">
              <p><strong>✓</strong> Free trial bookings will be automatically added</p>
              <p><strong>✓</strong> Calendar invites will be sent to customers</p>
              <p><strong>✓</strong> Updates and cancellations will sync automatically</p>
            </div>
            <button onclick="window.close()">Close This Window</button>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ [GOOGLE AUTH] Error during callback:", error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #f44336;">❌ Authentication Error</h1>
          <p>${error.message}</p>
          <a href="/api/google/auth" style="color: #2196F3;">Try Again</a>
        </body>
      </html>
    `);
  }
});

// ✅ Check authentication status
router.get("/status", async (req, res) => {
  try {
    const tokens = await tokenService.loadTokens();

    if (!tokens) {
      return res.json({
        connected: false,
        message: "Google Calendar not connected",
        authUrl: `${req.protocol}://${req.get("host")}/api/google/auth`,
      });
    }

    // Check if tokens are valid
    oauth2Client.setCredentials(tokens);

    return res.json({
      connected: true,
      message: "Google Calendar connected",
      tokenInfo: {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      },
    });
  } catch (error) {
    console.error("❌ [GOOGLE AUTH] Error checking status:", error.message);
    return res.status(500).json({
      connected: false,
      error: error.message,
    });
  }
});

// ✅ Disconnect (revoke tokens)
router.post("/disconnect", async (req, res) => {
  try {
    await tokenService.deleteTokens();

    res.json({
      success: true,
      message: "Google Calendar disconnected successfully",
    });
  } catch (error) {
    console.error("❌ [GOOGLE AUTH] Error disconnecting:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ✅ Test calendar access (list upcoming events)
router.get("/test", async (req, res) => {
  try {
    const result = await googleCalendarController.listUpcomingFreeTrials(5);

    res.json({
      success: true,
      message: "Calendar access working",
      upcomingEvents: result.events.length,
      events: result.events,
    });
  } catch (error) {
    console.error("❌ [GOOGLE AUTH] Test failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this route
router.get("/health", async (req, res) => {
  try {
    const tokens = await tokenService.loadTokens();

    if (!tokens) {
      return res.json({
        status: "disconnected",
        message: "Calendar not connected",
        action: "Visit /api/google/auth to connect",
      });
    }

    // Check if tokens are expired
    const now = Date.now();
    const isExpired = tokens.expiry_date && tokens.expiry_date < now;

    if (isExpired && !tokens.refresh_token) {
      return res.json({
        status: "expired",
        message: "Tokens expired and no refresh token available",
        action: "Reconnect at /api/google/auth",
      });
    }

    // Try to list events to verify access
    try {
      await googleCalendarController.initialize();
      await googleCalendarController.listUpcomingFreeTrials(1);

      return res.json({
        status: "healthy",
        message: "Calendar connected and working",
        tokenExpiry: new Date(tokens.expiry_date).toISOString(),
      });
    } catch (err) {
      return res.json({
        status: "error",
        message: "Calendar connected but not accessible",
        error: err.message,
        action: "Reconnect at /api/google/auth",
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
