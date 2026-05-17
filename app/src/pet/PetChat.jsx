import { useEffect, useRef, useState } from 'react';
import { buildPetImpersonation } from '../engine/PetVoice.js';

/**
 * PetChat — small "talk to your pet" input that lives under the ActionBar.
 * Sends through claudeSend with a personality-impersonation system prompt,
 * runs in chat mode (no project context), and streams the reply text into
 * the pet's normal speech bubble via the onPetSays callback.
 */
export function PetChat({
  petAppearance, petName, stage, personalityKey, bio, stats, intelligence, tokens,
  onPetSays,                       // (text) => void — drives speech bubble
  onBusyChange,                    // (bool) => void — optional
  disabled,                        // egg + dead lock the input
}) {
  const [value, setValue]   = useState('');
  const [busy, setBusy]     = useState(false);
  const sessionRef = useRef(null);
  const reqIdRef   = useRef(null);
  const accRef     = useRef('');
  const unsubRef   = useRef(null);
  const lockedOut  = disabled || stage === 0 || stage === 4;

  useEffect(() => () => { unsubRef.current?.(); }, []);

  function startListener() {
    if (unsubRef.current) return;
    unsubRef.current = window.claudigotchi?.onStream(({ requestId, event }) => {
      if (!event || !reqIdRef.current || requestId !== reqIdRef.current) return;

      // Text delta → update bubble in-flight
      if (event.type === 'stream_event' && event.event?.type === 'content_block_delta'
          && event.event.delta?.type === 'text_delta') {
        accRef.current += event.event.delta.text;
        onPetSays?.(accRef.current);
      }

      // Adopt the pet's own ongoing session id so multi-turn chats with the pet
      // can build personality memory across turns.
      const sid = event.session_id;
      if (sid && !sessionRef.current) sessionRef.current = sid;

      if (event.type === 'result') {
        setBusy(false);
        onBusyChange?.(false);
        accRef.current = '';
      }
    });
  }

  async function send() {
    const text = value.trim();
    if (!text || busy || lockedOut) return;
    if (!window.claudigotchi?.claudeSend) return;

    startListener();
    const reqId = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    reqIdRef.current = reqId;
    accRef.current   = '';
    onPetSays?.('…');                 // immediate "thinking" bubble
    setBusy(true);
    onBusyChange?.(true);
    setValue('');

    const system = buildPetImpersonation({
      petAppearance, petName, stage, personalityKey, bio, stats, intelligence, tokens,
    });

    await window.claudigotchi.claudeSend({
      message: text,
      sessionId: sessionRef.current,
      mode: 'chat',                   // isolated chats dir; doesn't pollute project
      requestId: reqId,
      systemPrompt: system,           // full override — pet IS the assistant here
      disallowedTools: [
        'Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep',
        'WebFetch', 'WebSearch', 'NotebookEdit', 'Task', 'TodoWrite',
      ],
      permissionMode: 'bypassPermissions', // we've gated tools to nothing already
    });
  }

  function keyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (lockedOut) return null;

  return (
    <div style={S.wrap}>
      <span style={S.label}>💬 talk to pet</span>
      <input
        style={S.input}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={keyDown}
        placeholder={busy ? '…thinking…' : 'say something to your pet…'}
        disabled={busy}
        maxLength={300}
      />
      <button style={{ ...S.btn, opacity: busy || !value.trim() ? 0.4 : 1 }}
              disabled={busy || !value.trim()} onClick={send}>↑</button>
    </div>
  );
}

const S = {
  wrap:  { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderTop: '1px solid #15151b' },
  label: { fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 },
  input: { flex: 1, minWidth: 0, background: '#15151b', color: '#e8e8e8', border: '1px solid #222', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none' },
  btn:   { width: 24, height: 22, borderRadius: 6, border: 'none', background: '#6c63ff', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, flexShrink: 0 },
};
