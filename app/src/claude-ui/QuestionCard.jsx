import { useState } from 'react';

/**
 * AskUserQuestion picker. Two modes:
 *   1. `group`: paginated multi-question wizard with Back / Next / Submit.
 *      Each pick is persisted via onPick; final Submit fires onSubmit.
 *   2. legacy single-question (props: question, options, answered): kept as
 *      a fallback used while the tool input is still streaming in.
 *
 * Picking does NOT auto-advance for groups — the user reviews their choice
 * and clicks Next themselves, matching the claude.ai desktop pattern.
 */
export function QuestionCard({
  // group mode
  group, submitted, onPick, onSubmit,
  // single mode (legacy / placeholder)
  question, options = [], answered, onAnswer, header,
}) {
  const isGroup = Array.isArray(group) && group.length > 0;
  const [idx, setIdx]       = useState(0);
  const [custom, setCustom] = useState('');
  const [showCustom, setShow] = useState(false);

  if (isGroup) {
    const total   = group.length;
    const current = group[idx];
    const picked  = current.answer;
    const allAnswered = group.every(q => q.answer);

    // Once submitted, collapse to a one-line "answered" summary so the long
    // multi-question card doesn't clog the transcript.
    if (submitted) {
      return (
        <div style={S.collapsed}>
          ✓ Answered {total} question{total === 1 ? '' : 's'} —{' '}
          {group.map((q, i) => (
            <span key={i} style={S.collapsedAnswer}>
              {q.header ? `${q.header}: ` : ''}{q.answer}
              {i < total - 1 ? '; ' : ''}
            </span>
          ))}
        </div>
      );
    }

    function pick(opt) {
      if (submitted) return;
      onPick?.(idx, opt.label);
      setCustom(''); setShow(false);
    }
    function submitCustom() {
      const text = custom.trim();
      if (!text || submitted) return;
      onPick?.(idx, text);
      setCustom(''); setShow(false);
    }

    return (
      <div style={S.wrap}>
        {/* Progress / header */}
        <div style={S.header}>
          <span style={S.step}>Q{idx + 1}/{total}</span>
          {current.header && <span>{current.header}</span>}
        </div>
        <div style={S.q}>{current.question}</div>

        <div style={S.opts}>
          {current.options.map((o, i) => (
            <button
              key={i}
              style={{
                ...S.opt,
                ...(picked === o.label ? S.optPicked : {}),
                opacity: submitted && picked !== o.label ? 0.4 : 1,
                cursor: submitted ? 'default' : 'pointer',
              }}
              onClick={() => pick(o)}
              disabled={!!submitted}
              title={o.description || ''}
            >
              <div style={S.optLabel}>{o.label}</div>
              {o.description && <div style={S.optDesc}>{o.description}</div>}
            </button>
          ))}
          <button
            style={{ ...S.opt, ...S.optOther, opacity: submitted ? 0.4 : 1, cursor: submitted ? 'default' : 'pointer' }}
            onClick={() => { if (!submitted) setShow(s => !s); }}
            disabled={!!submitted}
          >
            <div style={S.optLabel}>{showCustom ? '— hide custom —' : 'Other (type your own)'}</div>
          </button>
        </div>
        {showCustom && !submitted && (
          <div style={S.customRow}>
            <input
              style={S.customInput}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitCustom()}
              placeholder="type your answer…"
              autoFocus
            />
            <button style={S.customBtn} onClick={submitCustom} disabled={!custom.trim()}>Set</button>
          </div>
        )}

        {/* Nav */}
        <div style={S.nav}>
          <button
            style={{ ...S.navBtn, opacity: idx === 0 ? 0.3 : 1 }}
            disabled={idx === 0 || submitted}
            onClick={() => setIdx(i => Math.max(0, i - 1))}
          >← Back</button>
          {idx < total - 1 ? (
            <button
              style={{ ...S.navBtn, ...S.navBtnPrimary, opacity: !picked ? 0.4 : 1 }}
              disabled={!picked || submitted}
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            >Next →</button>
          ) : (
            <button
              style={{ ...S.navBtn, ...S.navBtnPrimary, opacity: (!allAnswered || submitted) ? 0.4 : 1 }}
              disabled={!allAnswered || submitted}
              onClick={onSubmit}
            >{submitted ? '✓ Submitted' : 'Submit answers'}</button>
          )}
        </div>

        {/* Tiny summary so user can see what they've picked so far */}
        {(idx > 0 || submitted) && (
          <div style={S.summary}>
            {group.map((q, i) => (
              <div key={i} style={S.summaryRow}>
                <span style={S.summaryQ}>{q.header || `Q${i + 1}`}:</span>
                <span style={S.summaryA}>{q.answer || <em style={{ color: '#666' }}>—</em>}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy single-question (placeholder while tool input streams in) ──
  function pick(opt) { if (!answered) onAnswer?.(opt.label, opt); }
  return (
    <div style={S.wrap}>
      {header && <div style={S.header}><span>{header}</span></div>}
      <div style={S.q}>{question}</div>
      <div style={S.opts}>
        {options.length === 0 && <div style={S.loading}>loading options…</div>}
        {options.map((o, i) => (
          <button key={i} style={S.opt} onClick={() => pick(o)} disabled={!!answered}>
            <div style={S.optLabel}>{o.label}</div>
            {o.description && <div style={S.optDesc}>{o.description}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  wrap:       { border: '1px solid #2a2a3a', background: '#0f0f17', borderRadius: 10, padding: 12, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  header:     { display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 },
  step:       { background: '#6c63ff', color: '#fff', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5 },
  q:          { fontSize: 13, color: '#e6e6e6', lineHeight: 1.5 },
  opts:       { display: 'flex', flexDirection: 'column', gap: 6 },
  opt:        { textAlign: 'left', padding: '8px 12px', background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 8, color: '#ddd', fontFamily: 'inherit', fontSize: 12, transition: 'background 0.1s ease, border-color 0.1s ease' },
  optPicked:  { background: '#1e3a2a', borderColor: '#3ddb6a', color: '#a8f5b4' },
  optOther:   { borderStyle: 'dashed', color: '#aaa' },
  optLabel:   { fontWeight: 600, marginBottom: 2 },
  optDesc:    { fontSize: 11, color: '#888', fontWeight: 400 },
  customRow:  { display: 'flex', gap: 6 },
  customInput:{ flex: 1, background: '#15151b', color: '#fff', border: '1px solid #2a2a3a', borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' },
  customBtn:  { padding: '6px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  nav:        { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  navBtn:     { padding: '6px 14px', background: '#15151b', color: '#ddd', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  navBtnPrimary: { background: '#6c63ff', color: '#fff', borderColor: '#6c63ff' },
  summary:    { borderTop: '1px solid #1a1a22', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 },
  summaryRow: { display: 'flex', gap: 6 },
  summaryQ:   { color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 70 },
  summaryA:   { color: '#a8f5b4' },
  loading:    { fontSize: 11, color: '#666', fontStyle: 'italic' },
  collapsed:  { padding: '4px 10px', background: 'transparent', borderLeft: '2px solid #7fffd4', margin: '2px 0', color: '#888', fontSize: 11, lineHeight: 1.5 },
  collapsedAnswer: { color: '#a8f5b4' },
};
