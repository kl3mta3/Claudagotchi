import { useState } from 'react';

/**
 * Renders an AskUserQuestion tool call as a friendly multiple-choice card
 * (with a free-text fallback). When the user picks an option we synthesize
 * a follow-up user message that contains the choice; the agent then sees
 * it on the next turn and continues. We don't try to plumb a real tool_result
 * back to the SDK because the message-based flow keeps everything in one
 * conversation thread the user can scroll through.
 */
export function QuestionCard({ question, options = [], answered, onAnswer }) {
  const [picked, setPicked]   = useState(null);
  const [custom, setCustom]   = useState('');
  const [showCustom, setShow] = useState(false);

  function pick(opt) {
    if (answered) return;
    setPicked(opt.label);
    onAnswer?.(opt.label, opt);
  }
  function submitCustom() {
    const text = custom.trim();
    if (!text || answered) return;
    setPicked(text);
    onAnswer?.(text, { label: text, custom: true });
  }

  return (
    <div style={S.wrap}>
      <div style={S.q}>{question}</div>
      <div style={S.opts}>
        {options.map((o, i) => (
          <button
            key={i}
            style={{
              ...S.opt,
              ...(picked === o.label ? S.optPicked : {}),
              opacity: answered && picked !== o.label ? 0.4 : 1,
              cursor: answered ? 'default' : 'pointer',
            }}
            onClick={() => pick(o)}
            disabled={!!answered}
            title={o.description || ''}
          >
            <div style={S.optLabel}>{o.label}</div>
            {o.description && <div style={S.optDesc}>{o.description}</div>}
          </button>
        ))}
        <button
          style={{ ...S.opt, ...S.optOther, opacity: answered ? 0.4 : 1, cursor: answered ? 'default' : 'pointer' }}
          onClick={() => { if (!answered) setShow(s => !s); }}
          disabled={!!answered}
        >
          <div style={S.optLabel}>{showCustom ? '— hide custom —' : 'Other (type your own)'}</div>
        </button>
      </div>
      {showCustom && !answered && (
        <div style={S.customRow}>
          <input
            style={S.customInput}
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitCustom()}
            placeholder="type your answer…"
            autoFocus
          />
          <button style={S.customBtn} onClick={submitCustom} disabled={!custom.trim()}>Send</button>
        </div>
      )}
      {answered && picked && (
        <div style={S.ans}>✓ {picked}</div>
      )}
    </div>
  );
}

const S = {
  wrap:       { border: '1px solid #2a2a3a', background: '#0f0f17', borderRadius: 10, padding: 12, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  q:          { fontSize: 13, color: '#e6e6e6', lineHeight: 1.5 },
  opts:       { display: 'flex', flexDirection: 'column', gap: 6 },
  opt:        { textAlign: 'left', padding: '8px 12px', background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 8, color: '#ddd', fontFamily: 'inherit', fontSize: 12, transition: 'background 0.1s ease, border-color 0.1s ease' },
  optPicked:  { background: '#1e3a2a', borderColor: '#3ddb6a', color: '#a8f5b4' },
  optOther:   { borderStyle: 'dashed', color: '#aaa' },
  optLabel:   { fontWeight: 600, marginBottom: 2 },
  optDesc:    { fontSize: 11, color: '#888', fontWeight: 400 },
  customRow:  { display: 'flex', gap: 6 },
  customInput:{ flex: 1, background: '#15151b', color: '#fff', border: '1px solid #2a2a3a', borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' },
  customBtn:  { padding: '6px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  ans:        { fontSize: 11, color: '#7fffd4', fontStyle: 'italic' },
};
