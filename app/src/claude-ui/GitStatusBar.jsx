import { useEffect, useState, useRef } from 'react';

/**
 * Slim git status strip that lives above the InputBar. Shows branch + change
 * counts; click to expand a small commit/discard panel.
 *
 * Polls every 4s while the folder is active. Also exposes a refresh() that
 * App.jsx can call after Write/Edit tool results land, so the counts update
 * without waiting for the next poll.
 */
export function GitStatusBar({ cwd }) {
  const [st, setSt]       = useState(null);
  const [open, setOpen]   = useState(false);
  const [msg, setMsg]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  async function refresh() {
    if (!cwd || !window.claudigotchi?.gitStatus) { setSt(null); return; }
    try {
      const r = await window.claudigotchi.gitStatus(cwd);
      setSt(r?.status || null);
    } catch { setSt(null); }
  }

  useEffect(() => {
    refresh();
    if (!cwd) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  // Not a git repo — show a slim "init?" strip instead of hiding entirely.
  // Useful when the user picked a folder that isn't versioned and wants to
  // track Claude's changes (or doesn't realize their picked folder isn't git).
  if (!st) {
    if (!cwd) return null;
    return (
      <div style={S.wrap}>
        <div style={{ ...S.row, cursor: 'default' }}>
          <span style={{ color: '#666' }}>⎇ not a git repo</span>
          <span style={S.spacer} />
          <button
            style={S.initBtn}
            onClick={async () => {
              if (!window.confirm(`Run "git init" in ${cwd}?\n\nThis creates a .git directory so Claude's edits can be tracked / reverted.`)) return;
              const r = await window.claudigotchi?.gitInit?.(cwd);
              if (r?.ok) refresh();
              else alert(`git init failed: ${r?.error || 'unknown'}`);
            }}
          >Initialize tracking</button>
        </div>
      </div>
    );
  }

  const totalChanges = (st.modified || 0) + (st.added || 0) + (st.deleted || 0) + (st.untracked || 0);

  async function commit() {
    if (!msg.trim() || busy) return;
    setBusy(true); setErr(null);
    const r = await window.claudigotchi.gitCommitAll(cwd, msg.trim());
    if (r?.ok) {
      setMsg(''); setOpen(false);
      refresh();
    } else {
      setErr(r?.error || 'commit failed');
    }
    setBusy(false);
  }
  async function discard() {
    if (!window.confirm('Discard ALL uncommitted changes? This cannot be undone.')) return;
    setBusy(true); setErr(null);
    const r = await window.claudigotchi.gitDiscardAll(cwd);
    if (!r?.ok) setErr(r?.error || 'discard failed');
    setBusy(false);
    refresh();
  }

  return (
    <div style={S.wrap}>
      <button style={S.row} onClick={() => setOpen(o => !o)} title="git status">
        <span style={S.branch}>⎇ {st.branch || '?'}</span>
        {(st.ahead > 0)  && <span style={S.aheadBadge}>↑{st.ahead}</span>}
        {(st.behind > 0) && <span style={S.behindBadge}>↓{st.behind}</span>}
        {st.clean ? (
          <span style={S.clean}>clean</span>
        ) : (
          <span style={S.dirty}>
            {st.modified  > 0 && <span style={{ color: '#ffc107' }}>~{st.modified} </span>}
            {st.added     > 0 && <span style={{ color: '#3ddb6a' }}>+{st.added} </span>}
            {st.deleted   > 0 && <span style={{ color: '#ff8d8d' }}>-{st.deleted} </span>}
            {st.untracked > 0 && <span style={{ color: '#888' }}>?{st.untracked}</span>}
          </span>
        )}
        <span style={S.spacer} />
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
      </button>
      {open && !st.clean && (
        <div style={S.commitPanel}>
          <input
            style={S.input}
            placeholder="commit message…"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commit()}
            disabled={busy}
          />
          <button style={S.commitBtn} onClick={commit} disabled={!msg.trim() || busy}>
            Commit {totalChanges} change{totalChanges === 1 ? '' : 's'}
          </button>
          <button style={S.discardBtn} onClick={discard} disabled={busy}>Discard</button>
          {err && <span style={S.err}>⚠ {err}</span>}
        </div>
      )}
      {open && st.clean && (
        <div style={S.cleanPanel}>nothing to commit — working tree is clean ✓</div>
      )}
    </div>
  );
}

const S = {
  wrap:     { display: 'flex', flexDirection: 'column', background: '#0e0e14', borderTop: '1px solid #1a1a22', borderBottom: '1px solid #1a1a22', flexShrink: 0 },
  row:      { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, textAlign: 'left' },
  branch:   { color: '#a855f7', fontWeight: 600 },
  aheadBadge:  { background: '#1e3a2a', color: '#7fffd4', padding: '0 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 },
  behindBadge: { background: '#3a1a1a', color: '#ff8d8d', padding: '0 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 },
  clean:    { color: '#666' },
  dirty:    { fontFamily: 'Consolas, monospace' },
  spacer:   { flex: 1 },
  chev:     { color: '#555' },
  commitPanel: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderTop: '1px solid #1a1a22', background: '#0a0a0f', flexWrap: 'wrap' },
  cleanPanel:  { padding: '6px 12px', borderTop: '1px solid #1a1a22', background: '#0a0a0f', color: '#666', fontSize: 11, fontStyle: 'italic' },
  input:    { flex: 1, minWidth: 200, background: '#15151b', color: '#fff', border: '1px solid #2a2a3a', borderRadius: 6, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit' },
  commitBtn:{ padding: '6px 12px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  discardBtn:{ padding: '6px 12px', background: 'transparent', color: '#ff8d8d', border: '1px solid #5a2a2a', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  err:      { color: '#ff8d8d', fontSize: 10 },
  initBtn:  { padding: '2px 10px', background: 'transparent', color: '#a855f7', border: '1px solid #2a2a3a', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
