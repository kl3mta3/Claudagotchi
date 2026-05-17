/**
 * SessionManager.js
 * Renderer-side wrapper around session-related IPC calls.
 * Provides list / create / resume / delete semantics over `claude` CLI sessions.
 *
 * Sessions are owned by the Claude CLI itself; this module just orchestrates
 * the IPC calls and caches the active session id for the current chat.
 */

export class SessionManager {
  constructor() {
    this.current  = null;       // { sessionId, cwd, title? }
    this.sessions = [];         // cached list (refreshed via refresh())
  }

  async refresh(cwd) {
    if (!window.claudigotchi) return [];
    const list = await window.claudigotchi.claudeSessions({ cwd });
    this.sessions = Array.isArray(list) ? list : [];
    return this.sessions;
  }

  /** Mark a session as currently active (used by InputBar.send) */
  setActive({ sessionId, cwd }) {
    this.current = { sessionId, cwd };
  }

  /** Send a message — creates a session if none active, otherwise resumes */
  async send({ message, cwd, sessionId }) {
    if (!window.claudigotchi) throw new Error('IPC unavailable');
    const targetSession = sessionId ?? this.current?.sessionId ?? null;
    const targetCwd     = cwd        ?? this.current?.cwd        ?? null;
    const result = await window.claudigotchi.claudeSend({
      message,
      sessionId: targetSession,
      cwd:       targetCwd,
    });
    if (result?.sessionId) this.setActive({ sessionId: result.sessionId, cwd: targetCwd });
    return result;
  }

  async resume({ sessionId, cwd }) {
    this.setActive({ sessionId, cwd });
    return this.current;
  }

  newSession({ cwd }) {
    this.current = { sessionId: null, cwd: cwd ?? null };
    return this.current;
  }

  async abort() {
    if (!this.current?.sessionId) return;
    await window.claudigotchi.claudeAbort({ sessionId: this.current.sessionId });
  }

  /** Best-effort delete — Claude CLI doesn't yet expose a delete subcommand
   *  via stable args, so we just drop it from our local cache. Future:
   *  add IPC handler that runs `claude session delete <id>`. */
  forget(sessionId) {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.current?.sessionId === sessionId) this.current = null;
  }
}
