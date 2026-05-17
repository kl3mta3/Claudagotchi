import { useState } from 'react';

const STATS = [
  { key: 'hunger',      label: 'Hng', name: 'Hunger',      hint: 'Drops over time. Feed your pet to refill.',                     color: '#f39c12', critical: v => v <= 15 },
  { key: 'happiness',   label: 'Hap', name: 'Happiness',   hint: 'Reflects mood. Play and clean tasks boost it.',                 color: '#ffd166', critical: v => v <= 20 },
  { key: 'cleanliness', label: 'Cln', name: 'Cleanliness', hint: 'Drops over time and from code bugs. Use Clean or shampoo.',     color: '#5dade2', critical: v => v <= 20 },
  { key: 'boredom',     label: 'Brd', name: 'Boredom',     hint: 'Rises when idle. Toys, games, and tasks bring it down.',         color: '#a29bfe', critical: v => v >= 80, invert: true },
  { key: 'sleepiness',  label: 'Slp', name: 'Sleepiness',  hint: 'Rises with heavy task load. Idle time or sleep aid lowers it.', color: '#7f8c8d', critical: v => v >= 80, invert: true },
  { key: 'weight',      label: 'Wgt', name: 'Weight',      hint: '50 is ideal. Snacks raise it, exercise lowers it.',             color: '#27ae60', critical: v => v <= 25 || v >= 75 },
  { key: 'health',      label: 'Hth', name: 'Health',      hint: 'Lagging indicator. Drops after other stats stay bad.',           color: '#e74c3c', critical: v => v <= 15 },
];

export function StatBars({ stats }) {
  const [hover, setHover] = useState(null); // { idx, x, y } | null

  if (!stats) return null;

  return (
    <div style={S.wrap}>
      {STATS.map((s, i) => {
        const v = Math.round(stats[s.key] ?? 0);
        const isCrit = s.critical(v);
        return (
          <div
            key={s.key}
            style={S.row}
            onMouseEnter={(e) => setHover({ idx: i, x: e.clientX, y: e.clientY })}
            onMouseMove={(e)  => setHover(h => h?.idx === i ? { idx: i, x: e.clientX, y: e.clientY } : h)}
            onMouseLeave={()  => setHover(null)}
          >
            <span style={S.label}>{s.label}</span>
            <div style={S.track}>
              <div style={{
                ...S.fill,
                width: `${v}%`,
                background: s.color,
                boxShadow: isCrit ? `0 0 6px ${s.color}` : 'none',
                animation: isCrit ? 'cgPulse 1.2s ease-in-out infinite' : 'none',
              }} />
            </div>
            <span style={{ ...S.num, color: isCrit ? s.color : '#777' }}>{v}</span>
          </div>
        );
      })}

      {hover && (
        <div style={{
          position: 'fixed',
          left: Math.min(hover.x + 14, window.innerWidth - 240),
          top:  Math.min(hover.y + 14, window.innerHeight - 80),
          background: '#0a0a0f', border: `1px solid ${STATS[hover.idx].color}66`, borderRadius: 6,
          padding: '6px 10px', maxWidth: 240, zIndex: 10000, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: STATS[hover.idx].color, marginBottom: 2 }}>
            {STATS[hover.idx].name} — {Math.round(stats[STATS[hover.idx].key] ?? 0)}/100
          </div>
          <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
            {STATS[hover.idx].hint}
          </div>
        </div>
      )}

      <style>{`@keyframes cgPulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}

const S = {
  wrap:  { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 6px' },
  row:   { display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontFamily: 'Consolas, monospace', cursor: 'help' },
  label: { width: 22, color: '#777', textTransform: 'uppercase', letterSpacing: 0.5 },
  track: { flex: 1, height: 6, background: '#0a0a0f', border: '1px solid #1a1a22', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', transition: 'width 0.4s ease' },
  num:   { width: 22, textAlign: 'right' },
};
