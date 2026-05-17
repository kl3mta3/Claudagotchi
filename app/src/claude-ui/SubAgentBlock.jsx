import { useState } from 'react';

/**
 * Sub-agent (Task tool) display. Renders as a collapsible card with the
 * sub-agent type, the user-readable description, the prompt that was sent,
 * and (when complete) the sub-agent's final response text.
 *
 * Visually distinct from the generic ToolUseDisplay so it reads as "a thing
 * the agent delegated" rather than "a tool the agent ran".
 */
export function SubAgentBlock({ description, prompt, subagentType, result, isError, streaming }) {
  const [open, setOpen] = useState(false);
  const resultText = formatResult(result);
  const headerText = streaming
    ? `🤖 Running sub-agent: ${description || '…'}`
    : isError
      ? `⚠ Sub-agent failed: ${description || ''}`
      : `🤖 Sub-agent: ${description || ''}`;

  return (
    <div style={S.wrap}>
      <button style={S.header} onClick={() => setOpen(o => !o)}>
        <span style={S.chev}>{open ? '▾' : '▸'}</span>
        <span style={S.kind}>{subagentType || 'general'}</span>
        <span style={S.title}>{headerText}</span>
        {streaming && <span style={S.dot}>•</span>}
      </button>
      {open && (
        <div style={S.body}>
          {prompt && (<>
            <div style={S.label}>prompt</div>
            <div style={S.prompt}>{prompt}</div>
          </>)}
          {!streaming && (<>
            <div style={S.label}>result</div>
            <div style={{ ...S.result, color: isError ? '#ff8d8d' : '#cfcfcf' }}>{resultText || '(no output)'}</div>
          </>)}
        </div>
      )}
    </div>
  );
}

function formatResult(r) {
  if (r === null || r === undefined) return '';
  if (typeof r === 'string') return r;
  if (Array.isArray(r)) return r.map(x => typeof x === 'string' ? x : (x?.text || JSON.stringify(x))).join('\n');
  return JSON.stringify(r, null, 2);
}

const S = {
  wrap:    { background: '#0e0e14', border: '1px solid #2a2a3a', borderLeft: '3px solid #a855f7', borderRadius: 6, margin: '4px 0', fontSize: 11 },
  header:  { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', cursor: 'pointer', userSelect: 'none', background: 'transparent', border: 'none', color: '#ddd', width: '100%', textAlign: 'left', fontFamily: 'inherit' },
  chev:    { color: '#777', width: 10, textAlign: 'center', fontSize: 10 },
  kind:    { fontSize: 9, fontWeight: 700, color: '#fff', background: '#a855f7', padding: '1px 6px', borderRadius: 3, letterSpacing: 0.5 },
  title:   { flex: 1, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot:     { color: '#a855f7', animation: 'cgPulseDot 1s ease-in-out infinite' },
  body:    { padding: '6px 12px 10px', borderTop: '1px solid #1a1a22' },
  label:   { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 3 },
  prompt:  { background: '#080810', borderRadius: 4, padding: '6px 8px', color: '#bbb', fontFamily: 'Consolas, monospace', fontSize: 10, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' },
  result:  { background: '#080810', borderRadius: 4, padding: '6px 8px', color: '#cfcfcf', fontFamily: 'Consolas, monospace', fontSize: 10, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap' },
};
