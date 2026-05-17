export function TabSwitcher({ mode, onChange }) {
  return (
    <div style={S.wrap}>
      <button
        style={{ ...S.tab, ...(mode === 'chat' ? S.tabActive : {}) }}
        onClick={() => onChange('chat')}
        title="Chat — tools enabled, no project root"
      >💬 Chat</button>
      <button
        style={{ ...S.tab, ...(mode === 'code' ? S.tabActive : {}) }}
        onClick={() => onChange('code')}
        title="Code — full project access (pick a folder)"
      >&lt;/&gt; Code</button>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex', gap: 2, padding: 2, background: '#0e0e14',
    border: '1px solid #1f1f28', borderRadius: 8,
    WebkitAppRegion: 'no-drag',
  },
  tab: {
    padding: '3px 12px', background: 'transparent', border: 'none',
    color: '#888', cursor: 'pointer', borderRadius: 6,
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  tabActive: {
    background: '#1a1a2a', color: '#fff',
  },
};
