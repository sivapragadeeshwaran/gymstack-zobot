// services/tokenService.js
const Token = require("../Models/token-model");

console.log("👉 [TOKEN SERVICE] Connect at: /api/google/auth");

class TokenService {
  /**
   * Save OAuth tokens to MongoDB
   * @param {Object} tokens - OAuth tokens from Google
   * @returns {Promise<boolean>}
   */
  async saveTokens(tokens) {
    try {
      console.log("💾 [TOKEN SERVICE] Saving tokens to MongoDB...");

      // Prepare token data with timestamp
      const tokenData = {
        service: "google_calendar",
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date,
        },
        userId: "system",
        saved_at: new Date(),
      };

      // Upsert: update if exists, create if doesn't exist
      await Token.findOneAndUpdate({ service: "google_calendar" }, tokenData, {
        upsert: true, // Create if doesn't exist
        new: true, // Return the updated document
      });

      console.log("✅ [TOKEN SERVICE] Tokens saved successfully to MongoDB");
      console.log(
        "   Expires:",
        tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : "Unknown"
      );

      return true;
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error saving tokens:", error.message);
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  /**
   * Load OAuth tokens from MongoDB
   * @returns {Promise<Object|null>} - Returns tokens or null if not found
   */
  async loadTokens() {
    try {
      console.log("📂 [TOKEN SERVICE] Loading tokens from MongoDB...");

      const tokenDoc = await Token.findOne({ service: "google_calendar" });

      if (!tokenDoc || !tokenDoc.tokens) {
        console.warn("⚠️ [TOKEN SERVICE] No tokens found in database");
        console.warn("   Please authenticate at: /api/google/auth");
        return null;
      }

      const tokens = tokenDoc.tokens;

      // Check token expiry
      if (tokens.expiry_date) {
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        const isExpired = expiryDate < now;

        if (isExpired && tokens.refresh_token) {
          console.log(
            "🔄 [TOKEN SERVICE] Token expired but refresh token available"
          );
        } else if (isExpired) {
          console.warn(
            "⚠️ [TOKEN SERVICE] Token expired and no refresh token - reconnection needed"
          );
        } else {
          const hoursUntilExpiry = Math.floor(
            (expiryDate - now) / (1000 * 60 * 60)
          );
          console.log(
            `✅ [TOKEN SERVICE] Token valid for ${hoursUntilExpiry} more hours`
          );
        }
      }

      console.log("✅ [TOKEN SERVICE] Tokens loaded successfully from MongoDB");
      return tokens;
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error loading tokens:", error.message);
      return null;
    }
  }

  /**
   * Delete OAuth tokens from MongoDB (for disconnection)
   * @returns {Promise<boolean>}
   */
  async deleteTokens() {
    try {
      console.log("🗑️ [TOKEN SERVICE] Deleting tokens from MongoDB...");

      await Token.findOneAndDelete({ service: "google_calendar" });

      console.log("✅ [TOKEN SERVICE] Tokens deleted successfully");
      return true;
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error deleting tokens:", error.message);
      throw new Error(`Failed to delete tokens: ${error.message}`);
    }
  }

  /**
   * Check if tokens exist in database
   * @returns {Promise<boolean>}
   */
  async tokensExist() {
    try {
      const tokenDoc = await Token.findOne({ service: "google_calendar" });
      return !!(tokenDoc && tokenDoc.tokens && tokenDoc.tokens.access_token);
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error checking tokens:", error.message);
      return false;
    }
  }

  /**
   * Get token expiry information
   * @returns {Promise<Object|null>}
   */
  async getTokenExpiry() {
    try {
      const tokens = await this.loadTokens();

      if (!tokens || !tokens.expiry_date) {
        return null;
      }

      const expiryDate = new Date(tokens.expiry_date);
      const now = new Date();
      const isExpired = expiryDate < now;
      const timeUntilExpiry = expiryDate - now;

      return {
        expiryDate: expiryDate.toISOString(),
        isExpired,
        timeUntilExpiry,
        hoursUntilExpiry: Math.floor(timeUntilExpiry / (1000 * 60 * 60)),
        hasRefreshToken: !!tokens.refresh_token,
      };
    } catch (error) {
      console.error(
        "❌ [TOKEN SERVICE] Error getting token expiry:",
        error.message
      );
      return null;
    }
  }

  /**
   * Verify token integrity
   * @returns {Promise<Object>}
   */
  async verifyTokenFile() {
    try {
      const exists = await this.tokensExist();

      if (!exists) {
        return {
          valid: false,
          reason: "Tokens do not exist in database",
          action: "Connect calendar at /api/google/auth",
        };
      }

      const tokens = await this.loadTokens();

      if (!tokens) {
        return {
          valid: false,
          reason: "Failed to load tokens from database",
          action: "Reconnect at /api/google/auth",
        };
      }

      // Check required fields
      if (!tokens.access_token) {
        return {
          valid: false,
          reason: "Missing access_token",
          action: "Reconnect at /api/google/auth",
        };
      }

      // Check expiry
      const expiry = await this.getTokenExpiry();

      if (expiry && expiry.isExpired && !tokens.refresh_token) {
        return {
          valid: false,
          reason: "Token expired with no refresh token",
          action: "Reconnect calendar at /api/google/auth",
        };
      }

      return {
        valid: true,
        tokenInfo: {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiryInfo: expiry,
        },
      };
    } catch (error) {
      return {
        valid: false,
        reason: error.message,
        action: "Check logs and reconnect if needed",
      };
    }
  }
}

// Export a singleton instance
module.exports = new TokenService();
