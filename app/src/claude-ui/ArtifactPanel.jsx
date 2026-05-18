import { useEffect, useRef, useState } from 'react';
import { PlanView } from './PlanView.jsx';
import { ArtifactFileView } from './ArtifactFileView.jsx';

/**
 * ArtifactPanel — right-side three-pane companion that shows plans, file
 * previews, and edit diffs as Claude works. Auto-opens on first artifact.
 *
 * Props:
 *   artifact         — current artifact { kind, ... }
 *   history          — previous artifacts for the Files tab list
 *   onClose          — user closed the panel
 *   onApprovePlan    — sends approval as next message
 *   onPickHistory(a) — switch the active artifact to a history entry
 */
export function ArtifactPanel({ artifact, history = [], onClose, onApprovePlan, onRejectPlan, planPendingApproval = false, onPickHistory, onCloseFile, onPopOut, isFloating }) {
  // Default tab follows the latest artifact kind, but user can override.
  const [tab, setTab] = useState(artifact?.kind === 'plan' ? 'plan' : 'files');

  useEffect(() => {
    if (artifact?.kind === 'plan') setTab('plan');
    else if (artifact?.kind === 'file') setTab('files');
  }, [artifact?.kind, artifact?.path, artifact?.markdown]);

  const fileHistory = history.filter(a => a.kind === 'file');
  const planHistory = history.filter(a => a.kind === 'plan');

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === 'plan' ? S.tabActive : {}) }} onClick={() => setTab('plan')}>
            Plan{planHistory.length > 0 ? ` · ${planHistory.length}` : ''}
          </button>
          <button style={{ ...S.tab, ...(tab === 'files' ? S.tabActive : {}) }} onClick={() => setTab('files')}>
            Files{fileHistory.length > 0 ? ` · ${fileHistory.length}` : ''}
          </button>
        </div>
        {onPopOut && !isFloating && (
          <button style={S.closeBtn} onClick={onPopOut} title="Pop out into own window">↗</button>
        )}
        <button style={S.closeBtn} onClick={onClose} title={isFloating ? 'Hide' : 'Hide panel'}>✕</button>
      </div>

      <div style={S.body}>
        {tab === 'plan' && (
          <PlanView
            plan={artifact?.kind === 'plan' ? artifact.markdown : planHistory[planHistory.length - 1]?.markdown}
            onApprove={onApprovePlan}
            onReject={onRejectPlan}
            pendingApproval={planPendingApproval}
          />
        )}
        {tab === 'files' && (
          <div style={S.filesLayout}>
            {/* Horizontal file tabs — uses FileTabStrip so when there are
                too many tabs to fit, the user gets browser-style ◀ ▶ arrows
                at the edges instead of a horizontal scrollbar. */}
            {fileHistory.length > 0 && (
              <FileTabStrip
                items={fileHistory}
                activeItem={artifact}
                onPick={onPickHistory}
                onClose={onCloseFile}
              />
            )}
            <div style={S.fileMain}>
              <ArtifactFileView artifact={artifact?.kind === 'file' ? artifact : fileHistory[fileHistory.length - 1]} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FileTabStrip — horizontal row of file tabs that shows ◀ ▶ arrows on either
 * end when the row overflows. Click an arrow to scroll one tab-width. Active
 * tab auto-scrolls into view when it changes. Native scrollbar hidden.
 */
function FileTabStrip({ items, activeItem, onPick, onClose }) {
  const scrollerRef = useRef(null);
  const [hasLeft, setHasLeft]   = useState(false);
  const [hasRight, setHasRight] = useState(false);

  function recomputeOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    setHasLeft(el.scrollLeft > 2);
    setHasRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }
  useEffect(() => {
    recomputeOverflow();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(recomputeOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { recomputeOverflow(); }, [items.length]);

  // Auto-scroll the active tab into view when it changes (eg user clicked a
  // history entry, or a new file artifact just landed).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const activeEl = el.querySelector('[data-active="1"]');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeItem]);

  function nudge(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 180, behavior: 'smooth' });
  }

  return (
    <div style={S.fileTabStrip}>
      <style>{`.cg-file-tabs::-webkit-scrollbar { display: none; }`}</style>
      {hasLeft && (
        <button style={S.scrollArrow} onClick={() => nudge(-1)} title="Scroll tabs left">◀</button>
      )}
      <div ref={scrollerRef} className="cg-file-tabs" style={S.fileTabs} onScroll={recomputeOverflow}>
        {items.map((a, i) => {
          const filename = (a.path || '').split(/[\\/]/).pop() || a.path || 'file';
          const active = activeItem === a;
          return (
            <div
              key={`${a.path}-${i}`}
              data-active={active ? '1' : '0'}
              style={{ ...S.fileTab, ...(active ? S.fileTabActive : {}) }}
              title={a.path}
            >
              <button style={S.fileTabBtn} onClick={() => onPick?.(a)}>
                <span style={S.fileOp}>{(a.op || 'view')[0].toUpperCase()}</span>
                <span style={S.fileTabName}>{filename}</span>
              </button>
              <button
                style={S.fileTabPop}
                onClick={(e) => {
                  e.stopPropagation();
                  const mode = a.editable ? 'edit' : 'preview';
                  window.claudigotchi?.filePopOut?.(a.path, mode);
                  onClose?.(a);
                }}
                title="Pop file into its own window"
              >↗</button>
              <button
                style={S.fileTabClose}
                onClick={(e) => { e.stopPropagation(); onClose?.(a); }}
                title="Close tab"
              >✕</button>
            </div>
          );
        })}
      </div>
      {hasRight && (
        <button style={S.scrollArrow} onClick={() => nudge(1)} title="Scroll tabs right">▶</button>
      )}
    </div>
  );
}

const S = {
  wrap:    { display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f', borderLeft: '1px solid #1e1e1e' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #1a1a22', background: '#0e0e14', flexShrink: 0 },
  tabs:    { display: 'flex', gap: 2, flex: 1 },
  tab:     { padding: '4px 10px', background: 'transparent', border: '1px solid transparent', color: '#888', cursor: 'pointer', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' },
  tabActive: { background: '#1a1a2a', color: '#fff', borderColor: '#2a2a3a' },
  closeBtn:{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: 13, padding: '0 6px' },
  body:    { flex: 1, minHeight: 0, overflow: 'hidden' },
  filesLayout: { display: 'flex', flexDirection: 'column', height: '100%' },
  fileTabStrip: { display: 'flex', alignItems: 'stretch', background: '#0e0e14', borderBottom: '1px solid #1a1a22', flexShrink: 0 },
  scrollArrow: { width: 24, background: '#0e0e14', border: 'none', borderRight: '1px solid #1a1a22', borderLeft: '1px solid #1a1a22', color: '#aaa', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', flexShrink: 0 },
  fileTabs:  { display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', background: '#0e0e14', scrollbarWidth: 'none' },
  fileTab:   { display: 'flex', alignItems: 'stretch', borderRight: '1px solid #1a1a22', minWidth: 0, maxWidth: 200 },
  fileTabActive: { background: '#1a1a2a' },
  fileTabBtn:{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 6px 8px', background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 },
  fileTabName:{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Consolas, monospace' },
  fileTabPop:  { background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '0 4px', fontSize: 11 },
  fileTabClose:{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '0 8px', fontSize: 11 },
  fileOp:    { fontSize: 9, fontWeight: 700, background: '#2a2a3a', color: '#ccc', padding: '0 4px', borderRadius: 2 },
  fileMain:  { flex: 1, minHeight: 0, overflow: 'hidden' },
};
