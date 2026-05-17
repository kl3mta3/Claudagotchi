import { useEffect, useState } from 'react';

export function SessionSidebar({
  mode = 'code', currentFolder, currentSessionId,
  hiddenSessions = [], showHidden = false,
  refreshKey = 0,
  onToggleShowHidden, onUnhideAll,
  onHideSession, onUnhideSession,
  onPickFolder, onNewSession, onResumeSession, onDeleteSession, onOpenSettings,
}) {
  const hiddenSet = new Set(hiddenSessions);

  const [sessions, setSessions] = useState([]);
  const [filter, setFilter]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [ctx, setCtx]           = useState(null); // { session, x, y }

  async function refresh() {
    if (!window.claudigotchi) return;
    setLoading(true);
    try {
      const list = await window.claudigotchi.claudeSessions({ cwd: currentFolder, mode });
      setSessions(Array.isArray(list) ? list : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [currentFolder, mode, refreshKey]);

  // Dismiss the context menu on any click anywhere
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [ctx]);

  const visible = showHidden ? sessions : sessions.filter(s => !hiddenSet.has(s.id));
  const filtered = visible.filter(s => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (s.id || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q);
  });
  const hiddenCount = sessions.filter(s => hiddenSet.has(s.id)).length;

  const folderLabel = currentFolder
    ? currentFolder.split(/[\\/]/).filter(Boolean).slice(-2).join('/')
    : 'pick a folder';

  return (
    <div style={S.wrap}>
      {mode === 'code' && (
        <div style={S.header}>
          <button style={S.folderBtn} onClick={onPickFolder} title={currentFolder || ''}>
            📁 {folderLabel}
          </button>
        </div>
      )}

      <button style={S.newBtn} onClick={onNewSession}>+ New {mode === 'chat' ? 'Chat' : 'Session'}</button>

      <input
        style={S.search}
        placeholder="filter sessions…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      {hiddenCount > 0 && (
        <label style={S.showAllRow} title="Include sessions you've right-click ignored">
          <input type="checkbox" checked={showHidden} onChange={onToggleShowHidden} />
          <span>show hidden ({hiddenCount})</span>
        </label>
      )}

      <div style={S.list}>
        {loading && <div style={S.empty}>loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={S.empty}>no sessions{currentFolder ? '' : mode === 'code' ? ' (pick a folder)' : ''}</div>
        )}
        {filtered.map(s => {
          const active = s.id === currentSessionId;
          const isHidden = hiddenSet.has(s.id);
          return (
            <div
              key={s.id}
              style={{ ...S.item, ...(active ? S.itemActive : {}), ...(isHidden ? S.itemHidden : {}) }}
              onContextMenu={e => {
                e.preventDefault();
                setCtx({ session: s, x: e.clientX, y: e.clientY });
              }}
            >
              <button style={S.itemBtn} onClick={() => onResumeSession(s)} title={s.id}>
                <div style={S.itemTitle}>
                  {isHidden && <span style={S.hiddenBadge}>hidden</span>}
                  {s.title || s.summary || '(untitled)'}
                </div>
                <div style={S.itemMeta}>{formatTime(s.updated || s.created)}</div>
              </button>
              <button
                style={S.delBtn}
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s); }}
                title="Permanently delete (right-click for Ignore/Hide)"
              >✕</button>
            </div>
          );
        })}
      </div>

      <button style={S.settingsBtn} onClick={onOpenSettings}>⚙ Settings</button>

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={[
            hiddenSet.has(ctx.session.id)
              ? { label: '↶ Unhide',  onClick: () => onUnhideSession?.(ctx.session) }
              : { label: '👁 Ignore (hide from list)', onClick: () => onHideSession?.(ctx.session) },
            { divider: true },
            { label: '🗑 Delete permanently', danger: true, onClick: () => onDeleteSession?.(ctx.session) },
          ]}
        />
      )}
    </div>
  );
}

function ContextMenu({ x, y, items }) {
  return (
    <div style={{ ...S.ctx, left: x, top: y }} onClick={e => e.stopPropagation()}>
      {items.map((it, i) => it.divider
        ? <div key={i} style={S.ctxDivider} />
        : (
          <button
            key={i}
            style={{ ...S.ctxItem, ...(it.danger ? S.ctxItemDanger : {}) }}
            onClick={() => { it.onClick(); }}
          >{it.label}</button>
        )
      )}
    </div>
  );
}

function formatTime(t) {
  if (!t) return '';
  const d = typeof t === 'number' ? new Date(t) : new Date(t);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const S = {
  wrap:        { display: 'flex', flexDirection: 'column', height: '100%', padding: 10, gap: 8, minHeight: 0, position: 'relative' },
  header:      { display: 'flex' },
  folderBtn:   { flex: 1, padding: '6px 10px', background: '#15151b', border: '1px solid #222', color: '#ccc', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  newBtn:      { padding: '8px 12px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  search:      { padding: '6px 10px', background: '#0a0a0f', border: '1px solid #1e1e1e', color: '#ccc', borderRadius: 8, fontSize: 11, outline: 'none' },
  showAllRow:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#777', padding: '2px 4px', cursor: 'pointer' },
  list:        { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 },
  empty:       { color: '#444', fontSize: 11, padding: '20px 4px', textAlign: 'center' },
  item:        { display: 'flex', alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', background: '#0e0e14', border: '1px solid #1a1a22', flexShrink: 0 },
  itemActive:  { background: '#1a1a2a', borderColor: '#3a3a5a' },
  itemHidden:  { opacity: 0.45, background: '#080810' },
  itemBtn:     { flex: 1, background: 'transparent', border: 'none', color: '#ccc', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', overflow: 'hidden', minWidth: 0, fontFamily: 'inherit' },
  itemTitle:   { fontSize: 11, fontWeight: 600, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 },
  itemMeta:    { fontSize: 9, color: '#555', marginTop: 4, lineHeight: 1.2 },
  hiddenBadge: { fontSize: 8, color: '#888', background: '#222', padding: '1px 5px', borderRadius: 3, marginRight: 5, fontWeight: 400, letterSpacing: 0.5, textTransform: 'uppercase' },
  delBtn:      { background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', padding: '0 8px', fontSize: 11 },
  settingsBtn: { padding: '6px 10px', background: '#0a0a0f', color: '#888', border: '1px solid #1e1e1e', borderRadius: 8, fontSize: 11, cursor: 'pointer' },

  ctx:         { position: 'fixed', background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 8, padding: 4, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', flexDirection: 'column' },
  ctxItem:     { background: 'transparent', border: 'none', color: '#ccc', padding: '6px 10px', textAlign: 'left', cursor: 'pointer', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' },
  ctxItemDanger: { color: '#ff8d8d' },
  ctxDivider:  { height: 1, background: '#2a2a3a', margin: '4px 6px' },
};
