// utils/sessionStore.js

class SessionStore {
  constructor() {
    this.sessions = new Map(); // Stores all visitor sessions
  }

  // Get session for a visitor
  get(visitorId) {
    return this.sessions.get(visitorId);
  }

  // Create or update session
  set(visitorId, data) {
    let existingSession = this.sessions.get(visitorId) || {};
    // Merge old session with new data
    const updatedSession = { ...existingSession, ...data };
    // Always store email if provided
    if (data.email) updatedSession.email = data.email;
    this.sessions.set(visitorId, updatedSession);
    return updatedSession;
  }

  // Reset session manually (useful for logout)
  clear(visitorId) {
    this.sessions.delete(visitorId);
  }

  // Automatically reset session if visitor email changes
  resetIfEmailChanged(visitorId, currentEmail) {
    const session = this.get(visitorId);
    if (session && session.email && session.email !== currentEmail) {
      this.clear(visitorId);
      return {};
    }
    return session || {};
  }
}

module.exports = new SessionStore();
