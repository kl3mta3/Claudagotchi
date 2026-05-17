export function Tombstones({ tombstones }) {
  if (!tombstones?.length) return <div style={S.empty}>no tombstones yet 🌱</div>;
  return (
    <div style={S.wrap}>
      {tombstones.map((t, i) => (
        <div key={i} style={S.stone} title={tooltip(t)}>
          <span style={S.emoji}>🪦</span>
          <span style={S.name}>{t.name || '???'}</span>
        </div>
      ))}
    </div>
  );
}

function tooltip(t) {
  const lines = [
    `${t.name || '???'} (${t.personality || 'unknown'})`,
    `Born:  ${fmt(t.born)}`,
    `Died:  ${fmt(t.died)}`,
    `Cause: ${t.cause || 'unknown'}`,
    `Stage: ${t.stageName || t.stage || '?'}`,
  ];
  if (t.intelligence != null) lines.push(`INT:   ${Math.floor(t.intelligence)}`);
  return lines.join('\n');
}

function fmt(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

const S = {
  wrap:  { display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 6px', flexShrink: 0 },
  empty: { padding: '4px 8px', color: '#333', fontSize: 10, fontStyle: 'italic' },
  stone: { display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: '#0e0e14', border: '1px solid #1a1a22', borderRadius: 6, flexShrink: 0, cursor: 'help' },
  emoji: { fontSize: 12 },
  name:  { fontSize: 10, color: '#888', fontFamily: 'Consolas, monospace' },
};
