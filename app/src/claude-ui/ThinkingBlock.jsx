import { useState } from 'react';

/**
 * Collapsible Claude "extended thinking" block. Collapsed by default so the
 * stream looks clean; click the header to expand and read the reasoning.
 */
export function ThinkingBlock({ text, streaming = false }) {
  const [open, setOpen] = useState(false);
  // Once finalized, an empty thinking block is useless — hide it rather than
  // showing a permanent "(empty)" stub. This happens when the model didn't
  // emit thinking deltas (e.g. tool-only response) and we never had text.
  if (!streaming && !text) return null;
  const label = streaming ? '🧠 Thinking…' : '🧠 Thought process';
  return (
    <div style={S.wrap}>
      <button style={S.header} onClick={() => setOpen(o => !o)}>
        <span>{open ? '▾' : '▸'}</span>
        <span style={S.label}>{label}</span>
        {streaming && <span style={S.dot}>•</span>}
      </button>
      {open && (
        <div style={S.body}>{text || '…'}</div>
      )}
    </div>
  );
}

const S = {
  wrap:   { margin: '4px 0', border: '1px solid #2a2a3a', borderRadius: 6, background: '#0d0d14', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', width: '100%', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11, textAlign: 'left', fontFamily: 'inherit' },
  label:  { color: '#aab' },
  dot:    { color: '#6c63ff', animation: 'cgPulseDot 1s ease-in-out infinite' },
  body:   { padding: '6px 12px', fontSize: 12, color: '#bbb', fontStyle: 'italic', whiteSpace: 'pre-wrap', lineHeight: 1.45, borderTop: '1px solid #1a1a22', maxHeight: 300, overflowY: 'auto' },
};

// Pulsing dot keyframe — injected once.
if (typeof document !== 'undefined' && !document.getElementById('cgPulseDotKeyframes')) {
  const s = document.createElement('style');
  s.id = 'cgPulseDotKeyframes';
  s.innerHTML = `@keyframes cgPulseDot { 0%,100%{opacity:0.3} 50%{opacity:1} }`;
  document.head.appendChild(s);
}
