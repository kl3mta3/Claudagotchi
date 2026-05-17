/**
 * ClaudeBridge.js
 * Manages communication with the claude CLI.
 * Called from React via window.claudigotchi IPC.
 * This module runs in the renderer — it calls IPC to main which does the actual spawning.
 */

export class ClaudeBridge {
  constructor({ onToken, onToolUse, onToolResult, onDone, onError }) {
    this.onToken      = onToken;
    this.onToolUse    = onToolUse;
    this.onToolResult = onToolResult;
    this.onDone       = onDone;
    this.onError      = onError;
    this.currentSession = null;
    this._unsubStream = null;
    this._unsubError  = null;
    this._init();
  }

  _init() {
    this._unsubStream = window.claudigotchi.onStream(({ sessionId, event }) => {
      this._handleStreamEvent(sessionId, event);
    });
    this._unsubError = window.claudigotchi.onError(({ sessionId, error }) => {
      this.onError?.({ sessionId, error });
    });
  }

  _handleStreamEvent(sessionId, event) {
    switch (event.type) {
      case 'content_block_delta':
        if (event.delta?.type === 'text_delta') {
          this.onToken?.({ sessionId, text: event.delta.text });
        }
        break;
      case 'content_block_start':
        if (event.content_block?.type === 'tool_use') {
          this.onToolUse?.({
            sessionId,
            toolId:   event.content_block.id,
            toolName: event.content_block.name,
            input:    event.content_block.input ?? {},
          });
        }
        break;
      case 'tool_result':
        this.onToolResult?.({
          sessionId,
          toolId: event.tool_use_id,
          result: event.content,
          isError: event.is_error,
        });
        break;
      case 'message_stop':
        this.onDone?.({ sessionId, usage: event.usage });
        break;
    }
  }

  async send({ message, sessionId, cwd }) {
    const result = await window.claudigotchi.claudeSend({ message, sessionId, cwd });
    this.currentSession = result.sessionId;
    return result;
  }

  async abort(sessionId) {
    await window.claudigotchi.claudeAbort({ sessionId: sessionId ?? this.currentSession });
  }

  async listSessions(cwd) {
    return window.claudigotchi.claudeSessions({ cwd });
  }

  destroy() {
    this._unsubStream?.();
    this._unsubError?.();
  }
}
