/**
 * StreamParser.js
 * Pure functions for parsing Anthropic stream-json events emitted by `claude --output-format stream-json`.
 * Runs in the renderer. No DOM, no IPC, no state.
 *
 * Normalizes raw events into a typed callback shape used by ChatPanel/ClaudeBridge:
 *   onText({ text })                          — incremental text chunk
 *   onToolUse({ id, name, input })            — assistant invoked a tool
 *   onToolResult({ id, content, isError })    — tool finished
 *   onMessageStop({ usage })                  — turn complete
 *   onError({ error })                        — anything we couldn't classify
 */

export function parseLine(rawLine, callbacks = {}) {
  const trimmed = rawLine?.toString().trim();
  if (!trimmed) return null;

  let event;
  try { event = JSON.parse(trimmed); }
  catch (e) { callbacks.onError?.({ error: 'malformed-json', line: trimmed }); return null; }

  return dispatch(event, callbacks);
}

export function parseChunk(chunk, callbacks = {}) {
  const lines = chunk.toString().split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    const e = parseLine(line, callbacks);
    if (e) events.push(e);
  }
  return events;
}

export function dispatch(event, callbacks = {}) {
  switch (event?.type) {
    case 'content_block_delta':
      if (event.delta?.type === 'text_delta') {
        callbacks.onText?.({ text: event.delta.text });
        return { type: 'text', text: event.delta.text };
      }
      return null;

    case 'content_block_start':
      if (event.content_block?.type === 'tool_use') {
        const payload = {
          id:    event.content_block.id,
          name:  event.content_block.name,
          input: event.content_block.input ?? {},
        };
        callbacks.onToolUse?.(payload);
        return { type: 'tool_use', ...payload };
      }
      return null;

    case 'content_block_stop':
      callbacks.onContentBlockStop?.({ index: event.index });
      return { type: 'content_block_stop', index: event.index };

    case 'tool_result': {
      const payload = {
        id:      event.tool_use_id,
        content: event.content,
        isError: !!event.is_error,
      };
      callbacks.onToolResult?.(payload);
      return { type: 'tool_result', ...payload };
    }

    case 'message_stop': {
      const payload = { usage: event.usage ?? {} };
      callbacks.onMessageStop?.(payload);
      return { type: 'message_stop', ...payload };
    }

    case 'message_start':
      callbacks.onMessageStart?.({ message: event.message });
      return { type: 'message_start' };

    default:
      return null;
  }
}
