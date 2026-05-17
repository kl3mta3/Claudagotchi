import { useEffect, useState } from 'react';

export function SessionSidebar({
  mode = 'code', currentFolder, currentSessionId,
  hiddenSessions = [], showHidden = false,
  refreshKey = 0,
  worktreeMap = {},          // { sessionId → { path, branch, repoRoot } }
  onToggleShowHidden, onUnhideAll,
  onHideSession, onUnhideSession,
  onPickFolder, onNewSession, onResumeSession, onDeleteSession, onOpenSettings,
  onOpenFile,                 // (path) => void — Explorer file click
  collapsed = false, onToggleCollapsed,
}) {
  const hiddenSet = new Set(hiddenSessions);

  const [sessions, setSessions] = useState([]);
  const [filter, setFilter]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [ctx, setCtx]           = useState(null); // { session, x, y }
  // Sessions / Explorer subview (Code tab only).
  const [view, setView]         = useState('sessions');

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

  // Collapsed strip: thin column with just ▸ + gear + plus icons.
  if (collapsed) {
    return (
      <div style={S.collapsedWrap}>
        <button style={S.collapseIcon} onClick={onToggleCollapsed} title="Expand sidebar">▸</button>
        <button style={S.collapseIcon} onClick={onNewSession} title={`New ${mode === 'chat' ? 'chat' : 'session'}`}>＋</button>
        <div style={{ flex: 1 }} />
        <button style={S.collapseIcon} onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {/* Top bar: collapse arrow only. The folder picker lives in the
          InputBar's + menu; the active folder is shown in the InputBar chip
          and in the session list — no redundant header label here. */}
      <div style={S.topBar}>
        {onToggleCollapsed && (
          <button style={S.collapseBtn} onClick={onToggleCollapsed} title="Collapse sidebar">◂</button>
        )}
      </div>

      {/* Sessions / Explorer subview toggle — Code tab only */}
      {mode === 'code' && (
        <div style={S.tabRow}>
          <button
            style={{ ...S.tabBtn, ...(view === 'sessions' ? S.tabBtnActive : {}) }}
            onClick={() => setView('sessions')}
          >Sessions</button>
          <button
            style={{ ...S.tabBtn, ...(view === 'explorer' ? S.tabBtnActive : {}) }}
            onClick={() => setView('explorer')}
          >Explorer</button>
        </div>
      )}

      {/* If on Explorer view, render the file tree and stop. */}
      {mode === 'code' && view === 'explorer' ? (
        <>
          {/* SESSION-SCOPED EXPLORER ANCHOR: keyed on the picked folder so it
              remounts cleanly when the session's primary cwd changes.
              Future multi-folder / @-reference support must NOT branch this
              off any secondary/attached folder — Explorer always reflects the
              session's main folder. */}
          <FileTree key={currentFolder || 'none'} root={currentFolder} onOpenFile={onOpenFile} />
          <button style={S.settingsBtn} onClick={onOpenSettings}>⚙ Settings</button>
        </>
      ) : (
      <>
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
                  {worktreeMap[s.id] && <span title={`worktree: ${worktreeMap[s.id].branch}`} style={{ marginRight: 4 }}>🌿</span>}
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
      </>
      )}

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

/** Recursive file/folder tree for the Explorer view. Lists `root` on mount,
 *  expands directories on click (lazy load), file click → onOpenFile(path). */
function FileTree({ root, onOpenFile }) {
  const [menu, setMenu] = useState(null);   // { path, name, x, y }
  // Register close-on-outside-click AFTER a 0ms delay so the same right-click
  // event that opened the menu can't immediately bubble up and close it.
  useEffect(() => {
    if (!menu) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const close = () => setMenu(null);
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
      // store on the function so cleanup can remove
      t.close = close;
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (t.close) {
        window.removeEventListener('click', t.close);
        window.removeEventListener('contextmenu', t.close);
      }
    };
  }, [menu]);

  if (!root) return <div style={S.empty}>pick a folder first</div>;
  return (
    <div style={S.treeWrap}>
      <FileTreeNode
        path={root}
        name={root.split(/[\\/]/).filter(Boolean).pop() || root}
        isDir
        initialOpen
        depth={0}
        onOpenFile={onOpenFile}
        onContextMenu={(e, p, n) => { e.preventDefault(); setMenu({ path: p, name: n, x: e.clientX, y: e.clientY }); }}
      />
      {menu && (
        <FileContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onOpenFile={onOpenFile}
        />
      )}
    </div>
  );
}

function FileTreeNode({ path, name, isDir, initialOpen, depth, onOpenFile, onContextMenu }) {
  const [open, setOpen]     = useState(!!initialOpen);
  const [entries, setEntries] = useState(null);  // null = unloaded
  const [error, setError]   = useState(null);

  async function load() {
    if (!window.claudigotchi?.listDir) { setError('listDir IPC missing'); return; }
    try {
      const r = await window.claudigotchi.listDir(path);
      if (r?.ok) setEntries(r.entries);
      else setError(r?.error || 'unknown');
    } catch (e) { setError(e?.message || String(e)); }
  }
  // Auto-load on mount when the node starts open (e.g. the root). Without
  // this, clicking Explorer showed "loading…" forever for the root because
  // load() was only ever called inside the click handler.
  useEffect(() => {
    if (isDir && open && entries == null && !error) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDir, open, path]);
  // Re-read this directory when one of its children gets deleted via the
  // file context menu. Cheap broadcast — every open dir node listens.
  useEffect(() => {
    if (!isDir) return;
    const h = (ev) => {
      const p = ev?.detail?.path;
      if (!p) return;
      // Match: the deleted file is a direct or nested child of this dir.
      if (p.startsWith(path)) load();
    };
    window.addEventListener('cg-file-deleted', h);
    return () => window.removeEventListener('cg-file-deleted', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDir, path]);
  function onSingleClick() {
    // Directories: single-click toggles expansion.
    // Files: single-click is a no-op (just selects visually) — see onDoubleClick.
    if (!isDir) return;
    if (!open && entries == null) load();
    setOpen(o => !o);
  }
  function onDoubleClick() {
    if (isDir) return;
    onOpenFile?.(path);
  }
  return (
    <div>
      <button
        style={{ ...S.treeRow, paddingLeft: 6 + depth * 12 }}
        onClick={onSingleClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e, path, name);
        }}
        title={path}
      >
        <span style={S.treeIcon}>{isDir ? (open ? '▾' : '▸') : '·'}</span>
        <span>{isDir ? '📁' : fileIcon(name)}</span>
        <span style={S.treeName}>{name}</span>
      </button>
      {isDir && open && (
        <div>
          {error && <div style={{ ...S.empty, paddingLeft: 18 + depth * 12 }}>⚠ {error}</div>}
          {entries == null && !error && <div style={{ ...S.empty, paddingLeft: 18 + depth * 12 }}>loading…</div>}
          {entries && entries.length === 0 && <div style={{ ...S.empty, paddingLeft: 18 + depth * 12 }}>(empty)</div>}
          {entries && entries.map(e => (
            <FileTreeNode
              key={e.path}
              path={e.path}
              name={e.name}
              isDir={!!e.isDir}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Right-click menu for a file tree row. Shows "Open" + (when renderable)
 *  "View as artifact" which forces the artifact panel into preview mode
 *  even for files the default-open would treat as plain text. */
function FileContextMenu({ menu, onClose, onOpenFile }) {
  const ext = (menu.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const renderable = ['svg','html','htm','md','markdown','png','jpg','jpeg','gif','webp','bmp','ico'].includes(ext);
  const items = [
    { label: '📄 Open (edit)', onClick: () => onOpenFile?.(menu.path) },
  ];
  if (renderable) {
    items.push({ label: '🎨 View as artifact', onClick: () => onOpenFile?.(menu.path, { previewOnly: true }) });
  }
  items.push({ label: '📂 Reveal in Explorer', onClick: () => window.claudigotchi?.revealInExplorer?.(menu.path) });
  items.push({
    label: '🗑️ Delete',
    danger: true,
    onClick: async () => {
      const ok = window.confirm(`Delete this file?\n\n${menu.path}\n\nThis sends the file to the OS recycle bin / trash. You can recover it from there if needed.`);
      if (!ok) return;
      const r = await window.claudigotchi?.deleteFile?.(menu.path);
      if (r?.ok) {
        // Nudge the FileTree to re-read its parent directory so the row vanishes.
        window.dispatchEvent(new CustomEvent('cg-file-deleted', { detail: { path: menu.path } }));
      } else {
        alert(`Failed to delete: ${r?.error || 'unknown error'}`);
      }
    },
  });
  return (
    <div
      style={{ ...S.ctx, left: menu.x, top: menu.y }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      {items.map((it, i) => (
        <button
          key={i}
          style={{ ...S.ctxItem, ...(it.danger ? { color: '#ff8d8d' } : {}) }}
          onClick={() => { it.onClick(); onClose(); }}
        >{it.label}</button>
      ))}
    </div>
  );
}
function fileIcon(name) {
  const ext = (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  if (!ext) return '📄';
  if (['md','markdown','txt','log'].includes(ext))           return '📝';
  if (['js','jsx','ts','tsx','mjs','cjs'].includes(ext))      return '🟨';
  if (['py','rb','go','rs','java','c','cpp','h','cs','swift'].includes(ext)) return '🟦';
  if (['html','htm'].includes(ext))                          return '🌐';
  if (['css','scss','less'].includes(ext))                   return '🎨';
  if (['json','yaml','yml','toml'].includes(ext))            return '⚙';
  if (['png','jpg','jpeg','gif','webp','svg','ico'].includes(ext)) return '🖼️';
  if (['exe','dll','so','dylib','bin'].includes(ext))         return '⛔';
  return '📄';
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
  wrap:        { display: 'flex', flexDirection: 'column', height: '100%', padding: 10, gap: 8, minHeight: 0, position: 'relative', boxSizing: 'border-box' },
  topBar:      { display: 'flex', gap: 6, alignItems: 'stretch' },
  collapseBtn: { width: 24, padding: 0, background: '#15151b', border: '1px solid #222', color: '#888', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  collapsedWrap:{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 8, height: '100%', boxSizing: 'border-box' },
  collapseIcon: { width: 28, height: 28, background: '#15151b', border: '1px solid #222', color: '#aaa', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  tabRow:      { display: 'flex', gap: 4, background: '#0a0a0f', border: '1px solid #1e1e1e', borderRadius: 8, padding: 2 },
  tabBtn:      { flex: 1, padding: '4px 8px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 6, fontSize: 11, fontFamily: 'inherit' },
  tabBtnActive:{ background: '#1a1a22', color: '#fff', fontWeight: 600 },
  header:      { display: 'flex' },
  folderBtn:   { flex: 1, padding: '6px 10px', background: '#15151b', border: '1px solid #222', color: '#ccc', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 },
  folderLabel: { flex: 1, padding: '6px 10px', background: '#0a0a0f', border: '1px solid #1e1e1e', color: '#999', borderRadius: 8, fontSize: 11, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 },
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
  treeWrap:    { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', background: '#0a0a0f', border: '1px solid #1e1e1e', borderRadius: 8, padding: '4px 0' },
  treeRow:     { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 11, width: '100%', whiteSpace: 'nowrap' },
  treeIcon:    { width: 10, color: '#666', fontSize: 9 },
  treeName:    { overflow: 'hidden', textOverflow: 'ellipsis' },

  ctx:         { position: 'fixed', background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 8, padding: 4, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', flexDirection: 'column' },
  ctxItem:     { background: 'transparent', border: 'none', color: '#ccc', padding: '6px 10px', textAlign: 'left', cursor: 'pointer', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' },
  ctxItemDanger: { color: '#ff8d8d' },
  ctxDivider:  { height: 1, background: '#2a2a3a', margin: '4px 6px' },
};
