import { PERSONALITIES } from '../engine/Personalities.js';

export function ChatBubble({ text, personalityKey }) {
  if (!text) return null;
  const p = PERSONALITIES[personalityKey] || {};
  const c = p.colors || { bg: '#15151b', text: '#eee', border: '#3338', accent: '#fff' };

  return (
    <div style={{
      ...S.wrap,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      fontFamily: p.font || 'inherit',
    }}>
      {text}
      <div style={{ ...S.tail, borderTopColor: c.bg }} />
    </div>
  );
}

const S = {
  wrap: {
    position: 'absolute',
    bottom: '100%', left: '50%', transform: 'translate(-50%, -8px)',
    maxWidth: 260, padding: '6px 12px', borderRadius: 12,
    fontSize: 12, lineHeight: 1.4, textAlign: 'center',
    whiteSpace: 'pre-wrap',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  tail: {
    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
    width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #15151b',
  },
};
