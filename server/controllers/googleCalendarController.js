// controllers/googleCalendarController.js
const { google } = require("googleapis");
const { oauth2Client } = require("../config/googleOAuth");
const tokenService = require("../services/tokenService");

class GoogleCalendarController {
  constructor() {
    this.initialized = false;
  }

  // Initialize OAuth client with saved tokens
  async initialize() {
    try {
      const tokens = await tokenService.loadTokens();

      if (!tokens) {
        console.error("❌ [GOOGLE CALENDAR] No authentication tokens found");
        throw new Error(
          "Google Calendar not connected. Please authenticate first."
        );
      }

      oauth2Client.setCredentials(tokens);

      // Setup automatic token refresh
      oauth2Client.on("tokens", async (newTokens) => {
        if (newTokens.refresh_token) {
          await tokenService.saveTokens(newTokens);
        } else {
          const existingTokens = await tokenService.loadTokens();
          await tokenService.saveTokens({ ...existingTokens, ...newTokens });
        }
      });

      this.initialized = true;
    } catch (error) {
      console.error(
        "❌ [GOOGLE CALENDAR] Initialization error:",
        error.message
      );
      throw error;
    }
  }

  // Format date and time for Google Calendar (ISO 8601 format)
  formatDateTime(rawDate, time, timeZone = "Asia/Kolkata") {
    try {
      // rawDate format: DD/MM/YYYY
      // time format: HH:MM (24-hour)

      const [day, month, year] = rawDate.split("/");
      const [hours, minutes] = time.split(":");

      // Create ISO date string
      const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:00`;

      return {
        dateTime: dateTimeString,
        timeZone: timeZone,
      };
    } catch (error) {
      console.error("❌ [GOOGLE CALENDAR] Error formatting date/time:", error);
      throw new Error("Invalid date/time format");
    }
  }

  // Calculate end time (1 hour after start time by default)
  calculateEndTime(
    rawDate,
    time,
    durationMinutes = 60,
    timeZone = "Asia/Kolkata"
  ) {
    try {
      const [day, month, year] = rawDate.split("/");
      const [hours, minutes] = time.split(":");

      // Create Date object
      const startDate = new Date(
        `${year}-${month}-${day}T${hours}:${minutes}:00`
      );

      // Add duration
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      // Format as ISO string
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
      const endDay = String(endDate.getDate()).padStart(2, "0");
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");

      return {
        dateTime: `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}:00`,
        timeZone: timeZone,
      };
    } catch (error) {
      console.error("❌ [GOOGLE CALENDAR] Error calculating end time:", error);
      throw new Error("Error calculating end time");
    }
  }

  // Create free trial booking event
  async createFreeTrialEvent(bookingData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Format start time
      const startDateTime = this.formatDateTime(
        bookingData.rawDate,
        bookingData.time,
        bookingData.timeZone || "Asia/Kolkata"
      );

      // Calculate end time (1 hour session)
      const endDateTime = this.calculateEndTime(
        bookingData.rawDate,
        bookingData.time,
        60, // 1 hour duration
        bookingData.timeZone || "Asia/Kolkata"
      );

      // Build event description
      let description = `
🏋️ Free Trial Booking

👤 Customer Details:
━━━━━━━━━━━━━━━━━━━━
Name: ${bookingData.name}
Email: ${bookingData.email}
Phone: ${bookingData.phone}
Booking ID: ${bookingData.bookingId}

📋 Session Details:
━━━━━━━━━━━━━━━━━━━━
Personal Training: ${bookingData.personalTraining ? "Yes" : "No"}
      `.trim();

      // Add trainer details if personal training is selected
      if (bookingData.personalTraining && bookingData.trainer) {
        description += `
Trainer: ${bookingData.trainer.name}`;

        if (bookingData.trainer.specialization) {
          description += `
Specialization: ${bookingData.trainer.specialization}`;
        }

        if (bookingData.trainer.experience) {
          description += `
Experience: ${bookingData.trainer.experience} years`;
        }
      }

      description += `

━━━━━━━━━━━━━━━━━━━━
Booked via: Zoho SalesIQ Chatbot
Status: Confirmed
      `.trim();

      // Create event object
      const event = {
        summary: `🏋️ Free Trial - ${bookingData.name}`,
        description: description,
        start: startDateTime,
        end: endDateTime,
        colorId: "10", // Green color for free trials
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 60 }, // 1 hour before
            { method: "popup", minutes: 30 }, // 30 minutes before
          ],
        },
      };

      // Add customer email as attendee if provided
      if (bookingData.email) {
        event.attendees = [
          {
            email: bookingData.email,
            displayName: bookingData.name,
            responseStatus: "accepted",
          },
        ];
        event.sendNotifications = true;
      }

      // Insert event into calendar
      const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        sendUpdates: bookingData.email ? "all" : "none",
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink || null,
        message: "Free trial booking added to Google Calendar",
      };
    } catch (error) {
      console.error(
        "❌ [GOOGLE CALENDAR] Error creating event:",
        error.message
      );

      // Handle specific error cases
      if (
        error.message.includes("authentication") ||
        error.message.includes("tokens")
      ) {
        throw new Error(
          "Google Calendar authentication expired. Please reconnect."
        );
      }

      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  // Update existing calendar event
  async updateFreeTrialEvent(eventId, bookingData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Format start time
      const startDateTime = this.formatDateTime(
        bookingData.rawDate,
        bookingData.time,
        bookingData.timeZone || "Asia/Kolkata"
      );

      // Calculate end time
      const endDateTime = this.calculateEndTime(
        bookingData.rawDate,
        bookingData.time,
        60,
        bookingData.timeZone || "Asia/Kolkata"
      );

      // Build updated description
      let description = `
🏋️ Free Trial Booking (UPDATED)

👤 Customer Details:
━━━━━━━━━━━━━━━━━━━━
Name: ${bookingData.name}
Email: ${bookingData.email}
Phone: ${bookingData.phone}
Booking ID: ${bookingData.bookingId}

📋 Session Details:
━━━━━━━━━━━━━━━━━━━━
Personal Training: ${bookingData.personalTraining ? "Yes" : "No"}
      `.trim();

      if (bookingData.personalTraining && bookingData.trainer) {
        description += `
Trainer: ${bookingData.trainer.name}`;

        if (bookingData.trainer.specialization) {
          description += `
Specialization: ${bookingData.trainer.specialization}`;
        }

        if (bookingData.trainer.experience) {
          description += `
Experience: ${bookingData.trainer.experience} years`;
        }
      }

      description += `

━━━━━━━━━━━━━━━━━━━━
Booked via: Zoho SalesIQ Chatbot
Status: Updated
Last Updated: ${new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}
      `.trim();

      // Update event object
      const event = {
        summary: `🏋️ Free Trial - ${bookingData.name}`,
        description: description,
        start: startDateTime,
        end: endDateTime,
        colorId: "10",
      };

      if (bookingData.email) {
        event.attendees = [
          {
            email: bookingData.email,
            displayName: bookingData.name,
            responseStatus: "accepted",
          },
        ];
      }

      // Update the event
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: eventId,
        resource: event,
        sendUpdates: bookingData.email ? "all" : "none",
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
        message: "Calendar event updated successfully",
      };
    } catch (error) {
      console.error(
        "❌ [GOOGLE CALENDAR] Error updating event:",
        error.message
      );
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }
  }

  // Cancel/Delete calendar event
  async cancelFreeTrialEvent(eventId, customerEmail = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Delete the event
      await calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
        sendUpdates: customerEmail ? "all" : "none",
      });

      return {
        success: true,
        message: "Calendar event cancelled successfully",
      };
    } catch (error) {
      console.error(
        "❌ [GOOGLE CALENDAR] Error cancelling event:",
        error.message
      );

      if (error.code === 404) {
        return {
          success: false,
          message: "Event not found or already deleted",
        };
      }

      throw new Error(`Failed to cancel calendar event: ${error.message}`);
    }
  }

  // Get event details
  async getEventDetails(eventId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const response = await calendar.events.get({
        calendarId: "primary",
        eventId: eventId,
      });

      return {
        success: true,
        event: response.data,
      };
    } catch (error) {
      console.error("❌ [GOOGLE CALENDAR] Error getting event:", error.message);
      throw new Error(`Failed to get event details: ${error.message}`);
    }
  }

  // List upcoming free trial events
  async listUpcomingFreeTrials(maxResults = 10) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: "startTime",
        q: "Free Trial", // Search for events with "Free Trial" in the title
      });

      return {
        success: true,
        events: response.data.items || [],
      };
    } catch (error) {
      console.error(
        "❌ [GOOGLE CALENDAR] Error listing events:",
        error.message
      );
      throw new Error(`Failed to list events: ${error.message}`);
    }
  }
}

module.exports = new GoogleCalendarController();
