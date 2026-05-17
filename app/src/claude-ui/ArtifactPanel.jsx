import { useEffect, useState } from 'react';
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
export function ArtifactPanel({ artifact, history = [], onClose, onApprovePlan, onPickHistory }) {
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
        <button style={S.closeBtn} onClick={onClose} title="Hide panel">✕</button>
      </div>

      <div style={S.body}>
        {tab === 'plan' && (
          <PlanView
            plan={artifact?.kind === 'plan' ? artifact.markdown : planHistory[planHistory.length - 1]?.markdown}
            onApprove={onApprovePlan}
          />
        )}
        {tab === 'files' && (
          <div style={S.filesLayout}>
            {fileHistory.length > 1 && (
              <div style={S.filesList}>
                {fileHistory.slice().reverse().map((a, i) => {
                  const filename = (a.path || '').split(/[\\/]/).pop();
                  const active = artifact === a;
                  return (
                    <button key={i} style={{ ...S.fileItem, ...(active ? S.fileItemActive : {}) }}
                            onClick={() => onPickHistory?.(a)}
                            title={a.path}>
                      <span style={S.fileOp}>{(a.op || 'view')[0].toUpperCase()}</span>
                      <span style={S.fileName}>{filename}</span>
                    </button>
                  );
                })}
              </div>
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

const S = {
  wrap:    { display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f', borderLeft: '1px solid #1e1e1e' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #1a1a22', background: '#0e0e14', flexShrink: 0 },
  tabs:    { display: 'flex', gap: 2, flex: 1 },
  tab:     { padding: '4px 10px', background: 'transparent', border: '1px solid transparent', color: '#888', cursor: 'pointer', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' },
  tabActive: { background: '#1a1a2a', color: '#fff', borderColor: '#2a2a3a' },
  closeBtn:{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: 13, padding: '0 6px' },
  body:    { flex: 1, minHeight: 0, overflow: 'hidden' },
  filesLayout: { display: 'flex', height: '100%' },
  filesList: { width: 130, borderRight: '1px solid #1a1a22', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: 4, flexShrink: 0 },
  fileItem:  { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', borderRadius: 4, fontSize: 11, fontFamily: 'inherit', textAlign: 'left' },
  fileItemActive: { background: '#1a1a2a', color: '#fff' },
  fileOp:    { fontSize: 9, fontWeight: 700, background: '#2a2a3a', color: '#ccc', padding: '0 4px', borderRadius: 2 },
  fileName:  { fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Consolas, monospace' },
  fileMain:  { flex: 1, minWidth: 0 },
};
