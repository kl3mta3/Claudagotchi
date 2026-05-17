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
  wrap:    { background: '#0e0e14', border: '1px solid #1d1d24', borderLeft: '3px solid #666', borderRadius: 6, margin: '6px 0', fontSize: 12 },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', userSelect: 'none' },
  tag:     { fontSize: 10, fontWeight: 600, color: '#0a0a0f', padding: '1px 6px', borderRadius: 3, letterSpacing: 0.5 },
  summary: { flex: 1, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Consolas, monospace', fontSize: 11 },
  state:   { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  chev:    { color: '#555', width: 12, textAlign: 'center' },
  body:    { padding: '0 10px 10px', borderTop: '1px solid #1d1d24' },
  label:   { fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  json:    { margin: 0, padding: 6, background: '#080810', borderRadius: 4, color: '#cfcfcf', fontFamily: 'Consolas, monospace', fontSize: 11, maxHeight: 240, overflow: 'auto' },
};
