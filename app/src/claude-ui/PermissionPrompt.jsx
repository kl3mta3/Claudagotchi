/**
 * Modal that asks the user whether to allow a tool call. Driven by the
 * canUseTool callback in electron.js — every pending request creates one
 * of these in a queue, oldest-first. User can Allow once, Allow always (for
 * this tool in this folder), or Deny with an optional reason.
 */
export function PermissionPrompt({ request, onDecide }) {
  if (!request) return null;
  const { toolName, input, cwd } = request;
  const short = summarizeInput(toolName, input);

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.title}>Allow tool call?</div>
        <div style={S.tool}>
          <span style={S.toolName}>{toolName}</span>
          {cwd && <span style={S.cwd}>· {cwd.split(/[\\/]/).slice(-2).join('/')}</span>}
        </div>
        {short && <div style={S.short}>{short}</div>}
        <details style={S.details}>
          <summary style={S.summary}>show full input</summary>
          <pre style={S.json}>{JSON.stringify(input ?? {}, null, 2)}</pre>
        </details>
        <div style={S.btnRow}>
          <button style={S.btnDeny}  onClick={() => onDecide({ behavior: 'deny', message: 'User denied the tool call.' })}>Deny</button>
          <button style={S.btnAllow} onClick={() => onDecide({ behavior: 'allow' })}>Allow once</button>
          <button style={S.btnAlways} onClick={() => onDecide({ behavior: 'allow', always: true })}>Always allow {toolName}</button>
        </div>
      </div>
    </div>
  );
}

function summarizeInput(toolName, input) {
  if (!input || typeof input !== 'object') return '';
  if (input.file_path) return input.file_path;
  if (input.command)   return `$ ${input.command}`.slice(0, 200);
  if (input.url)       return input.url;
  if (input.pattern)   return `pattern: ${input.pattern}`;
  return '';
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  card:    { width: 460, maxWidth: '94vw', background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  title:   { fontSize: 14, fontWeight: 700, color: '#fff' },
  tool:    { fontSize: 12, color: '#aaa' },
  toolName:{ background: '#6c63ff', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, letterSpacing: 0.5 },
  cwd:     { marginLeft: 8, color: '#888' },
  short:   { fontSize: 12, color: '#ddd', fontFamily: 'Consolas, monospace', background: '#0c0c12', padding: '8px 10px', borderRadius: 6, border: '1px solid #1a1a22', wordBreak: 'break-all' },
  details: { fontSize: 11 },
  summary: { color: '#888', cursor: 'pointer', fontSize: 11 },
  json:    { background: '#0c0c12', padding: '8px 10px', borderRadius: 6, border: '1px solid #1a1a22', maxHeight: 200, overflowY: 'auto', fontSize: 10, color: '#bbb', margin: '6px 0 0', whiteSpace: 'pre-wrap' },
  btnRow:  { display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 6 },
  btnDeny: { padding: '8px 14px', background: 'transparent', color: '#ff8d8d', border: '1px solid #5a2a2a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnAllow:{ padding: '8px 14px', background: '#1f1f33', color: '#e8e8ff', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnAlways:{ padding: '8px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
