// utils/sessionStore.js

class SessionStore {
  constructor() {
    this.sessions = new Map();

    setInterval(() => {
      this.cleanupOldSessions();
    }, 60 * 60 * 1000); // 1 hour

    console.log("✅ SessionStore initialized");
  }

  get(conversationId) {
    const session = this.sessions.get(conversationId);

    if (session) {
      session.lastAccessed = Date.now();

      const age = Date.now() - (session.createdAt || 0);
      const maxAge = 12 * 60 * 60 * 1000; // 12 hours

      if (age > maxAge) {
        console.log(`⏰ Session expired: ${conversationId}`);
        this.clear(conversationId);
        return null;
      }
    }

    return session;
  }

  set(conversationId, data) {
    const updatedSession = {
      ...data,
      lastAccessed: Date.now(),
    };

    if (!updatedSession.createdAt) {
      updatedSession.createdAt = Date.now();
    }

    this.sessions.set(conversationId, updatedSession);

    console.log(`💾 Session saved for ${conversationId}:`, {
      role: updatedSession.role || "not set",
      email: updatedSession.authenticatedEmail || "not set",
      isAuthenticated: updatedSession.isAuthenticated || false,
    });

    return updatedSession;
  }

  clear(conversationId) {
    console.log(`🗑️ Clearing session: ${conversationId}`);
    return this.sessions.delete(conversationId);
  }

  clearAll() {
    console.log("🗑️ Clearing ALL sessions");
    this.sessions.clear();
  }

  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 12 * 60 * 60 * 1000;

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

  getSessionCount() {
    return this.sessions.size;
  }

  listSessions() {
    const sessions = [];
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      sessions.push({
        conversationId: id,
        role: session.role || "not set",
        email: session.authenticatedEmail || "not set",
        isAuthenticated: session.isAuthenticated || false,
        ageMinutes: Math.floor((now - (session.createdAt || 0)) / 60000),
      });
    }

    return sessions;
  }
}

module.exports = new SessionStore();
