import { useEffect, useState } from 'react';
import { CodeBlock } from './CodeBlock.jsx';

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
        {artifact.op === 'edit'
          ? <DiffView oldText={artifact.oldText} newText={artifact.newText} ext={ext} />
          : <FileRenderer content={artifact.content} path={artifact.path} ext={ext} />}
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
    return <pre style={S.text}>{content || ''}</pre>; // simple — Plan view has the richer renderer
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
};
