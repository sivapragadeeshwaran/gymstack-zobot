// Models/token-model.js
const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      required: true,
      unique: true,
      default: "google_calendar",
    },
    tokens: {
      access_token: String,
      refresh_token: String,
      scope: String,
      token_type: String,
      expiry_date: Number,
    },
    userId: {
      type: String,
      default: "system",
    },
    saved_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Token", tokenSchema);
