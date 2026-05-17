import { CodeBlock } from './CodeBlock.jsx';

/**
 * Render a plan-mode markdown blob with an "Approve plan" CTA.
 * Plan source: ExitPlanMode tool input.plan
 */
export function PlanView({ plan, onApprove }) {
  if (!plan) return <div style={S.empty}>no active plan</div>;
  const parts = splitFences(plan);
  return (
    <div style={S.wrap}>
      <div style={S.body}>
        {parts.map((p, i) => p.type === 'code'
          ? <CodeBlock key={i} code={p.code} language={p.language} />
          : <MarkdownText key={i} text={p.text} />
        )}
      </div>
      {onApprove && (
        <div style={S.footer}>
          <button style={S.approveBtn} onClick={onApprove}>✓ Approve plan</button>
          <div style={S.hint}>or send a follow-up message asking for changes</div>
        </div>
      )}
    </div>
  );
}

/** Lightweight markdown renderer for plan text — headings, lists, bold, links, code spans. */
function MarkdownText({ text }) {
  if (!text) return null;
  return <div style={S.md}>{renderMd(text)}</div>;
}

function renderMd(text) {
  const lines = text.split('\n');
  const out = [];
  let listBuf = null; // { type: 'ul'|'ol', items: [] }

  function flushList() {
    if (!listBuf) return;
    const Tag = listBuf.type === 'ol' ? 'ol' : 'ul';
    out.push(<Tag key={`l-${out.length}`} style={S.list}>
      {listBuf.items.map((it, i) => <li key={i} style={S.li}>{inlineMd(it)}</li>)}
    </Tag>);
    listBuf = null;
  }

  lines.forEach((line, idx) => {
    if (/^###\s+/.test(line))  { flushList(); out.push(<h4 key={idx} style={S.h3}>{inlineMd(line.replace(/^###\s+/, ''))}</h4>); return; }
    if (/^##\s+/.test(line))   { flushList(); out.push(<h3 key={idx} style={S.h2}>{inlineMd(line.replace(/^##\s+/, ''))}</h3>); return; }
    if (/^#\s+/.test(line))    { flushList(); out.push(<h2 key={idx} style={S.h1}>{inlineMd(line.replace(/^#\s+/, ''))}</h2>); return; }

    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ol) {
      if (!listBuf || listBuf.type !== 'ol') { flushList(); listBuf = { type: 'ol', items: [] }; }
      listBuf.items.push(ol[2]);
      return;
    }
    if (ul) {
      if (!listBuf || listBuf.type !== 'ul') { flushList(); listBuf = { type: 'ul', items: [] }; }
      listBuf.items.push(ul[1]);
      return;
    }

    flushList();
    if (line.trim() === '') { out.push(<div key={idx} style={S.spacer} />); return; }
    out.push(<p key={idx} style={S.p}>{inlineMd(line)}</p>);
  });
  flushList();
  return out;
}

/** Inline: **bold**, *italic*, `code`, [text](url) */
function inlineMd(text) {
  const tokens = [];
  let i = 0, key = 0;
  const re = /(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) tokens.push(<span key={key++}>{text.slice(i, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**'))      tokens.push(<b key={key++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith('*'))  tokens.push(<i key={key++}>{tok.slice(1, -1)}</i>);
    else if (tok.startsWith('`'))  tokens.push(<code key={key++} style={S.codeInline}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) tokens.push(<a key={key++} href={link[2]} target="_blank" rel="noreferrer" style={S.link}>{link[1]}</a>);
    }
    i = m.index + tok.length;
  }
  if (i < text.length) tokens.push(<span key={key++}>{text.slice(i)}</span>);
  return tokens;
}

function splitFences(text) {
  const out = [];
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push({ type: 'code', language: m[1] || 'plaintext', code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

const S = {
  wrap:    { display: 'flex', flexDirection: 'column', height: '100%' },
  body:    { flex: 1, overflowY: 'auto', padding: 16, fontSize: 13, lineHeight: 1.55, color: '#ddd' },
  footer:  { borderTop: '1px solid #1e1e1e', padding: 12, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' },
  approveBtn: { padding: '8px 18px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  hint:    { fontSize: 10, color: '#555' },
  empty:   { padding: 24, color: '#444', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  md:      {},
  h1:      { fontSize: 18, color: '#fff', margin: '12px 0 6px' },
  h2:      { fontSize: 15, color: '#eee', margin: '10px 0 6px' },
  h3:      { fontSize: 13, color: '#ddd', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 1 },
  p:       { margin: '4px 0' },
  list:    { paddingLeft: 22, margin: '4px 0' },
  li:      { margin: '2px 0' },
  spacer:  { height: 6 },
  codeInline: { background: '#0a0a0f', padding: '1px 5px', borderRadius: 4, color: '#cfcfcf', fontFamily: 'Consolas, monospace', fontSize: 12 },
  link:    { color: '#9ad', textDecoration: 'underline' },
};
