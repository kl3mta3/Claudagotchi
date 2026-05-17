import { useState } from 'react';

const TOOL_COLORS = {
  Bash:        '#f39c12',
  Read:        '#3498db',
  Write:       '#9b59b6',
  Edit:        '#9b59b6',
  Glob:        '#16a085',
  Grep:        '#16a085',
  WebFetch:    '#e74c3c',
  WebSearch:   '#e74c3c',
  TodoWrite:   '#2ecc71',
  default:     '#666',
};

export function ToolUseDisplay({ name, input, result, isError }) {
  const [open, setOpen] = useState(false);
  const color = TOOL_COLORS[name] || TOOL_COLORS.default;

  return (
    <div style={{ ...S.wrap, borderLeftColor: color }}>
      <div style={S.header} onClick={() => setOpen(o => !o)}>
        <span style={{ ...S.tag, background: color }}>{name || 'tool'}</span>
        <span style={S.summary}>{summarize(input)}</span>
        <span style={{ ...S.state, color: isError ? '#e74c3c' : result ? '#2ecc71' : '#888' }}>
          {isError ? 'error' : result ? 'done' : 'running…'}
        </span>
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={S.body}>
          <div style={S.label}>input</div>
          <pre style={S.json}>{safeJson(input)}</pre>
          {result !== undefined && (
            <>
              <div style={S.label}>result</div>
              <pre style={{ ...S.json, color: isError ? '#ff8d8d' : '#cfcfcf' }}>{formatResult(result)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function summarize(input) {
  if (!input) return '';
  if (typeof input === 'string') return truncate(input, 70);
  if (input.command)  return truncate(input.command, 70);
  if (input.file_path) return truncate(input.file_path, 70);
  if (input.pattern)  return truncate(input.pattern, 70);
  if (input.url)      return truncate(input.url, 70);
  return truncate(safeJson(input), 70);
}

function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function safeJson(v)    { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
function formatResult(r) {
  if (r === null || r === undefined) return '';
  if (typeof r === 'string') return r;
  if (Array.isArray(r)) return r.map(x => typeof x === 'string' ? x : safeJson(x)).join('\n');
  return safeJson(r);
}

const S = {
  // Compact: no outer border, just a slim 2px colored left accent. ~30% less
  // vertical space than the boxed version.
  wrap:    { background: 'transparent', borderLeft: '2px solid #666', margin: '2px 0', fontSize: 11 },
  header:  { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', cursor: 'pointer', userSelect: 'none' },
  tag:     { fontSize: 9, fontWeight: 600, color: '#0a0a0f', padding: '0 5px', borderRadius: 2, letterSpacing: 0.3 },
  summary: { flex: 1, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Consolas, monospace', fontSize: 10 },
  state:   { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  chev:    { color: '#444', width: 10, textAlign: 'center', fontSize: 9 },
  body:    { padding: '4px 10px 8px 12px' },
  label:   { fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, marginBottom: 3 },
  json:    { margin: 0, padding: 6, background: '#080810', borderRadius: 4, color: '#cfcfcf', fontFamily: 'Consolas, monospace', fontSize: 10, maxHeight: 240, overflow: 'auto' },
};
