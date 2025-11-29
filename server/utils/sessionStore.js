// utils/sessionStore.js

class SessionStore {
  constructor() {
    this.sessions = new Map();

    // ✅ Auto-cleanup old sessions every 1 hour
    setInterval(() => {
      this.cleanupOldSessions();
    }, 60 * 60 * 1000); // 1 hour

    console.log("✅ SessionStore initialized with auto-cleanup");
  }

  // Get session for a conversation
  get(conversationId) {
    const session = this.sessions.get(conversationId);

    if (session) {
      // Update last accessed time
      session.lastAccessed = Date.now();

      // Check if session is too old (12 hours)
      const age = Date.now() - (session.createdAt || 0);
      const maxAge = 12 * 60 * 60 * 1000; // 12 hours

      if (age > maxAge) {
        console.log(`⏰ Session expired for ${conversationId}, clearing...`);
        this.clear(conversationId);
        return null;
      }
    }

    return session;
  }

  // Create or update session
  set(conversationId, data) {
    let existingSession = this.sessions.get(conversationId) || {};

    const updatedSession = {
      ...existingSession,
      ...data,
      lastAccessed: Date.now(),
    };

    // Ensure createdAt is set
    if (!updatedSession.createdAt) {
      updatedSession.createdAt = Date.now();
    }

    this.sessions.set(conversationId, updatedSession);

    console.log(`💾 Session updated for ${conversationId}:`, {
      role: updatedSession.role,
      email: updatedSession.authenticatedEmail,
      age: Date.now() - updatedSession.createdAt,
    });

    return updatedSession;
  }

  // Clear specific session
  clear(conversationId) {
    console.log(`🗑️ Clearing session: ${conversationId}`);
    return this.sessions.delete(conversationId);
  }

  // Clear all sessions (use cautiously - for debugging only)
  clearAll() {
    console.log("🗑️ Clearing ALL sessions");
    this.sessions.clear();
  }

  // Remove sessions older than specified time
  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 12 * 60 * 60 * 1000; // 12 hours

    let cleaned = 0;

    for (const [conversationId, session] of this.sessions.entries()) {
      const age = now - (session.createdAt || session.lastAccessed || 0);

      if (age > maxAge) {
        this.sessions.delete(conversationId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old sessions`);
    }

    console.log(`📊 Active sessions: ${this.sessions.size}`);
  }

  // Get session count (for debugging)
  getSessionCount() {
    return this.sessions.size;
  }

  // List all active sessions (for debugging)
  listSessions() {
    const sessions = [];
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      sessions.push({
        conversationId: id,
        role: session.role,
        email: session.authenticatedEmail,
        ageMinutes: Math.floor((now - (session.createdAt || 0)) / 60000),
        lastAccessedMinutes: Math.floor(
          (now - (session.lastAccessed || 0)) / 60000
        ),
      });
    }

    return sessions;
  }
}

module.exports = new SessionStore();
