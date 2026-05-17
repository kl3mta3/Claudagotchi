/**
 * Horizontal session-tab strip. Each tab shows a title + ✕ close. Click a tab
 * to switch (background tabs keep running). "+" on the right adds a new tab.
 */
export function TabStrip({ tabs, activeTabId, onSwitch, onClose, onNew }) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  return (
    <div style={S.wrap}>
      {tabs.map(t => {
        const active = t.id === activeTabId;
        return (
          <div key={t.id} style={{ ...S.tab, ...(active ? S.tabActive : {}) }}>
            <button style={S.tabBtn} onClick={() => onSwitch(t.id)} title={t.title}>
              <span style={S.tabName}>{t.title}</span>
            </button>
            {tabs.length > 1 && (
              <button
                style={S.closeBtn}
                onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                title="Close tab"
              >✕</button>
            )}
          </div>
        );
      })}
      <button style={S.addBtn} onClick={onNew} title="New session tab">＋</button>
    </div>
  );
}

const S = {
  wrap:      { display: 'flex', background: '#0a0a0f', borderBottom: '1px solid #1a1a22', overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 },
  tab:       { display: 'flex', alignItems: 'stretch', borderRight: '1px solid #1a1a22', minWidth: 0, maxWidth: 220 },
  tabActive: { background: '#15151b' },
  tabBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 6px 12px', background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 },
  tabName:   { fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  closeBtn:  { background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '0 8px', fontSize: 10 },
  addBtn:    { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 12px', fontSize: 16, fontWeight: 700 },
};
