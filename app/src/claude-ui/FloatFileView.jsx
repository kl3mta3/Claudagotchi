import { useEffect, useState } from 'react';
import { ArtifactFileView } from './ArtifactFileView.jsx';

/**
 * FloatFileView — renderer for a per-file pop-out window. Standalone: reads
 * the file from disk via readFileText, hosts the standard ArtifactFileView in
 * editable mode, and writes through the existing writeFileText IPC. Doesn't
 * sync with main-process artifact state — once popped, this window owns its
 * own copy and lifecycle. Close to dock back.
 */
export function FloatFileView() {
  const filePath = window.claudigotchi?.fileWindowPath?.() || '';
  const mode     = window.claudigotchi?.fileWindowMode?.() || 'edit';
  const preview  = mode === 'preview';
  const filename = filePath.split(/[\\/]/).pop() || filePath;
  const ext      = (filename.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';
  const [content, setContent] = useState(null);
  const [error,   setError]   = useState(null);

  // Image previews: ArtifactFileView loads them via file:// URL, so we don't
  // need to read the bytes ourselves — pass through with empty content.
  const skipRead = preview && ['png','jpg','jpeg','gif','webp','bmp','ico'].includes(ext);

  useEffect(() => {
    if (!filePath) { setError('no file path'); return; }
    if (skipRead) { setContent(''); return; }
    let cancelled = false;
    (async () => {
      const r = await window.claudigotchi?.readFileText?.(filePath);
      if (cancelled) return;
      if (r?.ok) setContent(r.content || '');
      else setError(r?.error || 'failed to read file');
    })();
    return () => { cancelled = true; };
  }, [filePath, skipRead]);

  const artifact = content != null
    ? (preview
        ? { kind: 'file', path: filePath, op: 'write', content }
        : { kind: 'file', path: filePath, op: 'edit',  content, editable: true })
    : null;

  return (
    <div style={S.root}>
      <div style={S.titleBar}>
        <span style={S.title} title={filePath}>{filename}</span>
        <button
          style={S.dockBtn}
          onClick={() => window.claudigotchi?.fileDockIn?.(filePath)}
          title="Dock back into main window"
        >↙</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {error ? <div style={S.err}>{error}</div>
         : artifact ? <ArtifactFileView artifact={artifact} />
         : <div style={S.loading}>loading…</div>}
      </div>
    </div>
  );
}

const S = {
  root:     { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0f' },
  titleBar: { height: 26, WebkitAppRegion: 'drag', background: '#0e0e14', borderBottom: '1px solid #1f1f28', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', flexShrink: 0 },
  title:    { fontSize: 11, color: '#bbb', fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 },
  dockBtn:  { WebkitAppRegion: 'no-drag', width: 22, height: 20, background: '#15151b', border: '1px solid #222', color: '#888', borderRadius: 4, cursor: 'pointer', fontSize: 11 },
  loading:  { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 12, letterSpacing: 2 },
  err:      { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f77', fontSize: 12 },
};
