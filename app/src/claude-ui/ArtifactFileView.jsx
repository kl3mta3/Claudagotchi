import { useEffect, useState } from 'react';
import { CodeBlock } from './CodeBlock.jsx';
import { CodeMirrorEditor } from './CodeMirrorEditor.jsx';
import { PlanView } from './PlanView.jsx';

const HTML_EXT  = new Set(['html', 'htm']);
const SVG_EXT   = new Set(['svg']);
const IMG_EXT   = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico']);
const MD_EXT    = new Set(['md', 'markdown']);

/**
 * ArtifactFileView
 * Renders a file artifact from Write / Edit / Read tool calls.
 * Props:
 *   artifact: { kind:'file', path, op:'write'|'edit'|'read', content?, oldText?, newText? }
 */
export function ArtifactFileView({ artifact }) {
  if (!artifact || artifact.kind !== 'file') return <div style={S.empty}>no file selected</div>;

  const ext = (artifact.path || '').split('.').pop()?.toLowerCase() || '';
  const filename = (artifact.path || '').split(/[\\/]/).pop();

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.opTag} title={artifact.path}>{(artifact.op || 'view').toUpperCase()}</span>
        <span style={S.filename} title={artifact.path}>{filename || artifact.path}</span>
      </div>
      <div style={S.body}>
        {artifact.op === 'binary' ? (
          <BinaryWarning content={artifact.content} path={artifact.path} />
        ) : artifact.editable ? (
          <EditableFile artifact={artifact} ext={ext} />
        ) : artifact.op === 'edit' ? (
          <DiffView oldText={artifact.oldText} newText={artifact.newText} ext={ext} />
        ) : (
          <FileRenderer content={artifact.content} path={artifact.path} ext={ext} />
        )}
      </div>
    </div>
  );
}

/**
 * Binary file warning — matches the VS Code-style "file is binary or unsupported"
 * message the user referenced. Includes an Open Anyway button that re-fetches
 * as text (best-effort UTF-8).
 */
function BinaryWarning({ content, path }) {
  const [forceText, setForceText] = useState(null);
  async function openAnyway() {
    const r = await window.claudigotchi?.readFileText?.(path);
    setForceText(r?.content || '(could not read as text)');
  }
  if (forceText != null) return <pre style={S.text}>{forceText}</pre>;
  return (
    <div style={S.warnWrap}>
      <div style={S.warnIcon}>⚠</div>
      <div style={S.warnText}>{content || 'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.'}</div>
      <button style={S.warnBtn} onClick={openAnyway}>Open Anyway</button>
    </div>
  );
}

/** Editable text file. Save button writes via the write-file-text IPC. */
function EditableFile({ artifact, ext }) {
  const [text, setText]       = useState(artifact.content ?? '');
  const [saved, setSaved]     = useState(true);
  const [formatOnSave, setFmt]= useState(() => {
    try { return localStorage.getItem('cg.formatOnSave') !== '0'; } catch { return true; }
  });
  // Diff refresh counter — bump after every successful save so the editor
  // re-pulls `git diff HEAD -- <file>` and repaints the gutter / line bg.
  const [diffKey, setDiffKey] = useState(0);
  // Keep editor in sync when a different file is selected.
  useEffect(() => { setText(artifact.content ?? ''); setSaved(true); setDiffKey(k => k + 1); }, [artifact.path, artifact.content]);
  async function save() {
    let out = text;
    if (formatOnSave) {
      try { out = await CodeMirrorEditor.formatForSave(text, ext); } catch {}
      if (out !== text) setText(out);   // reflect formatted text in the editor
    }
    const r = await window.claudigotchi?.writeFileText?.(artifact.path, out);
    if (r?.ok) { setSaved(true); setDiffKey(k => k + 1); }
  }
  return (
    <div style={S.editWrap}>
      <CodeMirrorEditor
        value={text}
        language={ext}
        filePath={artifact.path}
        refreshDiffKey={diffKey}
        onChange={(v) => { setText(v); setSaved(false); }}
      />
      <div style={S.editRow}>
        <span style={{ color: saved ? '#7fffd4' : '#ffc89e', fontSize: 11 }}>{saved ? '✓ saved' : '● unsaved'}</span>
        <label style={{ ...S.fmtLabel, opacity: formatOnSave ? 1 : 0.6 }} title="Run Prettier on supported languages when saving">
          <input
            type="checkbox"
            checked={formatOnSave}
            onChange={e => {
              setFmt(e.target.checked);
              try { localStorage.setItem('cg.formatOnSave', e.target.checked ? '1' : '0'); } catch {}
            }}
            style={{ marginRight: 4 }}
          />
          format on save
        </label>
        <button style={S.saveBtn} onClick={save} disabled={saved}>Save</button>
      </div>
    </div>
  );
}

function FileRenderer({ content, path, ext }) {
  if (HTML_EXT.has(ext)) {
    // `allow-scripts` is required for inline + module scripts (Three.js,
    // import maps, etc). `allow-same-origin` lets script-loaded resources
    // resolve under the iframe's null origin. `allow-popups` keeps any
    // window.open from the artifact from silently failing. This combo is
    // the minimum needed to render a real interactive HTML artifact while
    // still keeping it cross-origin-isolated from the host app.
    return (
      <iframe
        title={path}
        srcDoc={content || ''}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        referrerPolicy="no-referrer"
        style={S.iframe}
      />
    );
  }
  if (SVG_EXT.has(ext)) {
    return (
      <div style={S.svgFrame}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
             dangerouslySetInnerHTML={{ __html: content || '' }} />
      </div>
    );
  }
  if (IMG_EXT.has(ext)) {
    return <ImageRenderer path={path} />;
  }
  if (MD_EXT.has(ext)) {
    // Render markdown via the PlanView helper (lightweight headings / lists /
    // fences / inline formatting). Same look as plan artifacts.
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px', background: '#0a0a0f' }}>
        <PlanView plan={content || ''} />
      </div>
    );
  }
  return <CodeBlock code={content || ''} language={ext || 'plaintext'} />;
}

function ImageRenderer({ path }) {
  // Use file:// to load from disk. Electron renderer can load file:// for local files
  // as long as webSecurity isn't strict for them — works for our preview case.
  const url = path ? `file:///${String(path).replace(/\\/g, '/').replace(/^\/+/, '')}` : '';
  return <div style={S.imgWrap}><img src={url} alt={path} style={S.img} /></div>;
}

function DiffView({ oldText, newText, ext }) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  return (
    <div style={S.diff}>
      <div style={S.diffSide}>
        <div style={S.diffLabel}>before</div>
        <pre style={{ ...S.diffPre, color: '#ff8d8d' }}>{oldLines.map((l, i) => (
          <div key={i} style={S.diffLine}>{l || ' '}</div>
        ))}</pre>
      </div>
      <div style={S.diffSide}>
        <div style={S.diffLabel}>after</div>
        <pre style={{ ...S.diffPre, color: '#7fffd4' }}>{newLines.map((l, i) => (
          <div key={i} style={S.diffLine}>{l || ' '}</div>
        ))}</pre>
      </div>
    </div>
  );
}

const S = {
  wrap:     { display: 'flex', flexDirection: 'column', height: '100%' },
  header:   { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #1a1a22', background: '#0e0e14', flexShrink: 0 },
  opTag:    { fontSize: 9, fontWeight: 700, background: '#6c63ff', color: '#fff', padding: '1px 6px', borderRadius: 3, letterSpacing: 1 },
  filename: { fontSize: 11, color: '#bbb', fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  body:     { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' },
  iframe:   { flex: 1, border: 'none', background: '#fff', width: '100%', height: '100%' },
  svgFrame: { flex: 1, background: 'repeating-conic-gradient(#1a1a22 0% 25%, #14141d 0% 50%) 0/16px 16px', overflow: 'auto' },
  imgWrap:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', overflow: 'auto', padding: 12 },
  img:      { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  text:     { flex: 1, margin: 0, padding: 12, color: '#ddd', fontFamily: 'Consolas, monospace', fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap' },
  empty:    { padding: 24, color: '#444', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  diff:     { display: 'flex', width: '100%', minHeight: 0, height: '100%' },
  diffSide: { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a1a22', minWidth: 0 },
  diffLabel:{ fontSize: 9, color: '#666', padding: '4px 8px', borderBottom: '1px solid #1a1a22', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 },
  diffPre:  { flex: 1, margin: 0, padding: 8, overflow: 'auto', fontFamily: 'Consolas, monospace', fontSize: 11, background: '#080810' },
  diffLine: { padding: '0 4px', whiteSpace: 'pre' },
  warnWrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, background: '#0a0a0f' },
  warnIcon: { fontSize: 32, color: '#ffc107' },
  warnText: { color: '#bbb', fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 },
  warnBtn:  { padding: '8px 18px', background: '#1f77ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  editWrap: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
  editArea: { flex: 1, background: '#0a0a0f', color: '#ddd', border: 'none', padding: 12, fontFamily: 'Consolas, monospace', fontSize: 12, outline: 'none', resize: 'none', minHeight: 0 },
  editRow:  { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '6px 10px', borderTop: '1px solid #1a1a22', background: '#0e0e14', flexShrink: 0 },
  saveBtn:  { padding: '6px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  fmtLabel: { fontSize: 10, color: '#aaa', cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none' },
};
