import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

export function CodeBlock({ code, language }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute('data-highlighted');
      hljs.highlightElement(ref.current);
    }
  }, [code, language]);

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  const lang = language || 'plaintext';
  return (
    <div style={S.wrap}>
      <div style={S.bar}>
        <span style={S.lang}>{lang}</span>
        <button style={S.copyBtn} onClick={copy}>{copied ? '✓ copied' : 'copy'}</button>
      </div>
      <pre style={S.pre}><code ref={ref} className={`language-${lang}`}>{code}</code></pre>
    </div>
  );
}

const S = {
  wrap:    { background: '#0a0a0f', border: '1px solid #222', borderRadius: 8, margin: '8px 0', overflow: 'hidden' },
  bar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: '#15151b', borderBottom: '1px solid #222' },
  lang:    { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  copyBtn: { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', padding: '2px 8px', fontSize: 10, borderRadius: 4 },
  pre:     { margin: 0, padding: 12, fontSize: 12, lineHeight: 1.5, overflow: 'auto', fontFamily: 'Consolas, "Courier New", monospace' },
};
