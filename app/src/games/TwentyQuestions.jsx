import { useEffect, useRef, useState } from 'react';
import { PERSONALITIES } from '../engine/Personalities.js';

/**
 * 20 Questions.
 * Pet picks a secret topic via Claude CLI in personality voice. User asks yes/no.
 * The pet replies in-character. On guess: 'I guess [topic]' — pet judges.
 *
 * NOTE: This routes through window.claudigotchi.claudeSend with a hidden
 * preamble. Each round opens a fresh session so the secret stays inside one chat.
 */
export function TwentyQuestions({ open, onEnd, petName, personalityKey, memorySummary }) {
  const [history, setHistory] = useState([]); // {role,text}
  const [input, setInput]     = useState('');
  const [secret, setSecret]   = useState(null); // never shown
  const [questionCount, setQC] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(null); // 'won'|'lost'|null
  const sessionRef = useRef(null);
  const accRef = useRef('');
  const reqIdRef = useRef(null);
  const timeoutRef = useRef(null);
  const [error, setError] = useState(null);

  const p = PERSONALITIES[personalityKey] || {};
  const max = 20;
  const left = max - questionCount;

  // Stream listener
  useEffect(() => {
    if (!open || !window.claudigotchi) return;
    const unsub = window.claudigotchi.onStream(({ sessionId: sid, requestId, event }) => {
      // Only process events for OUR queries (tagged with our reqId).
      if (reqIdRef.current && requestId !== reqIdRef.current) return;
      if (sessionRef.current && sid !== sessionRef.current) return;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        accRef.current += event.delta.text;
        setHistory(h => {
          const last = h[h.length - 1];
          if (last?.role === 'pet' && last.streaming) {
            return [...h.slice(0, -1), { ...last, text: accRef.current }];
          }
          return [...h, { role: 'pet', text: accRef.current, streaming: true }];
        });
      }
      // Clear timeout once we see ANY event for our request
      if (timeoutRef.current && (!reqIdRef.current || requestId === reqIdRef.current)) {
        clearTimeout(timeoutRef.current); timeoutRef.current = null;
      }
      if (event.type === 'message_stop') {
        setHistory(h => {
          const last = h[h.length - 1];
          if (last?.role === 'pet') return [...h.slice(0, -1), { ...last, streaming: false }];
          return h;
        });
        // Try to capture the secret from a META: marker on the first reply
        if (!secret) {
          const m = accRef.current.match(/META_SECRET:\s*([^\n]+)/);
          if (m) {
            setSecret(m[1].trim());
            // Strip the META line from displayed text
            setHistory(h => {
              const last = h[h.length - 1];
              if (last?.role === 'pet') {
                return [...h.slice(0, -1), { ...last, text: last.text.replace(/META_SECRET:[^\n]*\n?/, '').trim() }];
              }
              return h;
            });
          }
        }
        accRef.current = '';
        setBusy(false);
      }
    });
    return unsub;
  }, [open, secret]);

  // Kick off: pet picks a secret
  useEffect(() => {
    if (!open) return;
    setHistory([]); setInput(''); setSecret(null); setQC(0); setOver(null); setSessionId(null);
    sessionRef.current = null;
    accRef.current = '';
    setBusy(true);

    const system = buildSystem(petName, personalityKey, memorySummary);
    const opening = `${system}\n\nYou are starting a game of 20 Questions. Pick ONE secret common noun (an everyday object, animal, or concept) and remember it. On your FIRST reply only, output a hidden line first: META_SECRET: <your secret>  (this line will be stripped before being shown to the user). Then say a short greeting in character telling the user you've picked something and they may begin asking yes/no questions. Do NOT reveal the secret.`;
    sendToPet(opening, /*isFirst*/ true);
  }, [open]);

  async function sendToPet(text, isFirst = false) {
    if (!window.claudigotchi) { setError('Claude is not available'); return; }
    setBusy(true);
    setError(null);
    accRef.current = '';
    const reqId = `tq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    reqIdRef.current = reqId;
    // Hard timeout — if nothing comes back in 30s, surface an error + retry.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setBusy(false);
      setError('Pet didn\'t respond (timeout). Try again?');
      timeoutRef.current = null;
    }, 30_000);
    try {
      const res = await window.claudigotchi.claudeSend({
        message: text,
        sessionId: isFirst ? null : sessionRef.current,
        cwd: null,
        mode: 'chat',                       // run in dedicated chat dir, never the user's project
        requestId: reqId,                   // tag events so the main chat ignores them
        enableThinking: false,              // 20Q answers are short — skip extended thinking
      });
      if (res?.sessionId) {
        sessionRef.current = res.sessionId;
        setSessionId(res.sessionId);
      }
      if (res?.error) {
        setError(String(res.error).slice(0, 200));
        setBusy(false);
      }
    } catch (e) {
      setError(`Send failed: ${e.message || e}`);
      setBusy(false);
    }
  }
  function retryLast() {
    if (!history.length) return;
    setError(null);
    sendToPet(history[history.length - 1]?.text || 'Are you ready?');
  }

  function ask() {
    const text = input.trim();
    if (!text || busy || over) return;
    setHistory(h => [...h, { role: 'user', text }]);
    setInput('');

    const isGuess = /^(i\s*guess|is\s*it|are\s*you)/i.test(text);
    const newCount = questionCount + 1;
    setQC(newCount);

    // Detect guess match
    if (isGuess && secret && new RegExp(`\\b${escape(secret)}\\b`, 'i').test(text)) {
      finish('won');
      return;
    }
    if (newCount >= max) {
      sendToPet(`The user has used all ${max} questions and asked: "${text}". Answer briefly in character, then reveal the secret was "${secret}".`);
      setTimeout(() => finish('lost'), 1500);
      return;
    }

    const hint = newCount >= 15 ? ' If they\'re close, you may offer a small hint in character.' : '';
    sendToPet(`User asks (question ${newCount}/${max}): "${text}". Answer ONLY yes/no (you may add a 1-sentence personality remark). Stay in character. The secret remains "${secret || '(unset)'}". Never reveal it.${hint}`);
  }

  function finish(result) {
    setOver(result);
    setTimeout(() => onEnd?.({ won: result === 'won', secret }), 1800);
  }

  if (!open) return null;

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🤔 20 Questions with {petName || 'your pet'}</h2>
          <div style={S.counter}>{left} left</div>
          <button style={S.close} onClick={() => onEnd?.({ won: false, secret })}>✕</button>
        </div>
        <div style={S.feed}>
          {history.map((m, i) => (
            <div key={i} style={{ ...S.msg, ...(m.role === 'user' ? S.userMsg : S.petMsg), fontFamily: m.role === 'pet' ? (p.font || 'inherit') : 'inherit' }}>
              {m.text || (m.streaming ? '…' : '')}
            </div>
          ))}
          {over === 'won' && <div style={S.win}>🎉 You got it! It was {secret}.</div>}
          {over === 'lost' && <div style={S.lose}>😅 Out of questions! The answer was {secret}.</div>}
          {error && (
            <div style={S.errBox}>
              ⚠ {error}
              <button style={{ ...S.btn, marginLeft: 8, padding: '4px 10px' }} onClick={retryLast}>Retry</button>
            </div>
          )}
        </div>
        <div style={S.inputRow}>
          <input
            style={S.input}
            placeholder={over ? 'game over' : busy ? 'pet is thinking…' : 'ask a yes/no question, or "I guess …"'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            disabled={busy || over}
          />
          <button style={S.btn} onClick={ask} disabled={busy || over || !input.trim()}>Ask</button>
        </div>
      </div>
    </div>
  );
}

function escape(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildSystem(name, personalityKey, memorySummary) {
  const p = PERSONALITIES[personalityKey] || {};
  return [
    `You are ${name || 'a Tamagotchi pet'}, a ${p.label || 'companion'} (${personalityKey}).`,
    `Speak in your personality's voice — short, in-character. Examples: "${(p.idleQuips?.[0]) || ''}"`,
    memorySummary ? `What you remember about your human: ${memorySummary}` : '',
  ].filter(Boolean).join('\n');
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { width: 540, maxWidth: '92vw', height: 540, maxHeight: '85vh', background: '#111', border: '1px solid #222', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #222' },
  title:   { fontSize: 14, color: '#eee', margin: 0, flex: 1 },
  counter: { fontSize: 12, color: '#ffd166', fontFamily: 'Consolas, monospace' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  feed:    { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  msg:     { padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, maxWidth: '85%', whiteSpace: 'pre-wrap' },
  userMsg: { alignSelf: 'flex-end', background: '#1f1f33', color: '#e8e8ff' },
  petMsg:  { alignSelf: 'flex-start', background: '#15151b', color: '#eee', border: '1px solid #1f1f28' },
  inputRow:{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #222' },
  input:   { flex: 1, padding: '8px 12px', background: '#15151b', color: '#eee', border: '1px solid #222', borderRadius: 8, fontSize: 13, outline: 'none' },
  btn:     { padding: '8px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  win:     { padding: 10, background: '#1a3a2a', color: '#7fffd4', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  lose:    { padding: 10, background: '#3a1a1a', color: '#ff8d8d', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  errBox:  { padding: 10, background: '#3a2410', color: '#ffc89e', border: '1px solid #5a3818', borderRadius: 8, fontSize: 12, textAlign: 'center' },
};
