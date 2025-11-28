const fs = require("fs").promises;
const path = require("path");

// ✅ Define the path where tokens will be stored
const TOKEN_PATH = path.join(__dirname, "..", "config", "google-tokens.json");

class TokenService {
  /**
   * Save OAuth tokens to file system
   * @param {Object} tokens - OAuth tokens from Google
   * @returns {Promise<boolean>}
   */
  async saveTokens(tokens) {
    try {
      // Ensure the config directory exists
      const configDir = path.dirname(TOKEN_PATH);
      await fs.mkdir(configDir, { recursive: true });

      // Prepare token data with timestamp
      const tokenData = {
        ...tokens,
        saved_at: new Date().toISOString(),
        expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      };

      // Write tokens to file with pretty formatting
      await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify(tokenData, null, 2),
        "utf-8"
      );

      return true;
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error saving tokens:", error.message);
      console.error("📍 [TOKEN SERVICE] Attempted path:", TOKEN_PATH);
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  /**
   * Load OAuth tokens from file system
   * @returns {Promise<Object|null>} - Returns tokens or null if not found
   */
  async loadTokens() {
    try {
      // Check if token file exists
      try {
        await fs.access(TOKEN_PATH);
      } catch (error) {
        console.log("👉 [TOKEN SERVICE] Connect at: /api/google/auth");
        return null;
      }

      // Read and parse token file
      const data = await fs.readFile(TOKEN_PATH, "utf-8");
      const tokens = JSON.parse(data);

      if (tokens.expiry_date) {
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        const isExpired = expiryDate < now;

        if (isExpired && tokens.refresh_token) {
          console.log(
            "🔄 [TOKEN SERVICE] Token expired but refresh token available"
          );
        } else if (isExpired) {
          console.log(
            "⚠️ [TOKEN SERVICE] Token expired and no refresh token - reconnection needed"
          );
        }
      }

      return tokens;
    } catch (error) {
      console.error("❌ [TOKEN SERVICE] Error loading tokens:", error.message);

      // If file is corrupted, log detailed error
      if (error instanceof SyntaxError) {
        console.error(
          "❌ [TOKEN SERVICE] Token file is corrupted (invalid JSON)"
        );
        console.error(
          "👉 [TOKEN SERVICE] Delete the file and reconnect: /api/google/auth"
        );
      }

      return null;
    }
  }

  /**
   * Delete OAuth tokens (for disconnection)
   * @returns {Promise<boolean>}
   */
  async deleteTokens() {
    try {
      await fs.unlink(TOKEN_PATH);

      return true;
    } catch (error) {
      // If file doesn't exist, that's okay
      if (error.code === "ENOENT") {
        return true;
      }

      console.error("❌ [TOKEN SERVICE] Error deleting tokens:", error.message);
      throw new Error(`Failed to delete tokens: ${error.message}`);
    }
  }

  /**
   * Check if tokens exist
   * @returns {Promise<boolean>}
   */
  async tokensExist() {
    try {
      await fs.access(TOKEN_PATH);

      return true;
    } catch (error) {
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
   * Verify token file integrity
   * @returns {Promise<Object>}
   */
  async verifyTokenFile() {
    try {
      const exists = await this.tokensExist();

      if (!exists) {
        return {
          valid: false,
          reason: "Token file does not exist",
          action: "Connect calendar at /api/google/auth",
        };
      }

      const tokens = await this.loadTokens();

      if (!tokens) {
        return {
          valid: false,
          reason: "Failed to load tokens",
          action: "Delete token file and reconnect",
        };
      }

      // Check required fields
      const requiredFields = ["access_token"];
      const missingFields = requiredFields.filter((field) => !tokens[field]);

      if (missingFields.length > 0) {
        return {
          valid: false,
          reason: `Missing required fields: ${missingFields.join(", ")}`,
          action: "Delete token file and reconnect",
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

// ✅ Export a singleton instance
module.exports = new TokenService();
