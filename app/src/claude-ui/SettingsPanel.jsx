export function SettingsPanel({
  open, onClose,
  petPos, onPetPos,
  theme, onTheme,
  alwaysOnTop, onAlwaysOnTop,
  usage, blockOverage, onBlockOverage, onResetUsage,
}) {
  if (!open) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>Settings</h2>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <Section label="Pet panel position">
          <div style={S.row}>
            {['bottom', 'top', 'right', 'float'].map(p => (
              <button
                key={p}
                style={{ ...S.choice, ...(petPos === p ? S.choiceActive : {}) }}
                onClick={() => onPetPos(p)}
              >{p}</button>
            ))}
          </div>
        </Section>

        <Section label="Theme">
          <div style={S.row}>
            {['dark', 'light'].map(t => (
              <button
                key={t}
                style={{ ...S.choice, ...(theme === t ? S.choiceActive : {}) }}
                onClick={() => onTheme(t)}
              >{t}</button>
            ))}
          </div>
        </Section>

        <Section label="Floating pet">
          <label style={S.toggleRow}>
            <input type="checkbox" checked={!!alwaysOnTop} onChange={e => onAlwaysOnTop(e.target.checked)} />
            <span>Always on top</span>
          </label>
        </Section>

        <Section label="Usage">
          <UsagePanel usage={usage} blockOverage={blockOverage} onBlockOverage={onBlockOverage} onResetUsage={onResetUsage} />
        </Section>

        <Section label="Claude Agent SDK">
          <div style={S.note}>
            Messages run through the Claude Agent SDK in-process — same OAuth session
            as <code style={S.code}>claude auth login</code>, so usage is billed against
            your claude.ai subscription, not pay-per-token API.
          </div>
        </Section>

        <Section label="Tool permissions">
          <div style={S.note}>
            "Always allow" decisions are persisted to <code style={S.code}>~/.claudigotchi/always-allow.json</code>.
            Clear them to be re-prompted for every tool call again.
          </div>
          <button
            style={{ ...S.choice, marginTop: 8, borderColor: '#5a2a2a', color: '#ff8d8d' }}
            onClick={async () => {
              if (!window.confirm('Clear all remembered tool permissions? You\'ll be prompted again for every Bash/Write/Edit call.')) return;
              await window.claudigotchi?.clearAlwaysAllow?.();
              alert('Cleared.');
            }}
          >Clear remembered permissions</button>
        </Section>
      </div>
    </div>
  );
}

function UsagePanel({ usage, blockOverage, onBlockOverage, onResetUsage }) {
  const s          = usage?.session;
  const rateLimits = usage?.rateLimits || {};
  const windowUse  = usage?.windowUsage || {};
  const caps       = usage?.limitCaps || { five_hour: 45, weekly: 480 };

  // Show whichever limit types we know about, in a sensible order.
  const types = Array.from(new Set([
    ...Object.keys(rateLimits),
    ...Object.keys(windowUse),
    'five_hour', 'weekly',          // ensure both placeholders even if no event yet
  ]));
  const ordered = types.filter((t, i, a) => a.indexOf(t) === i);

  return (
    <div style={U.wrap}>
      <label style={U.toggleRow} title="If on, requests that would use overage credit are blocked.">
        <input type="checkbox" checked={!!blockOverage} onChange={e => onBlockOverage(e.target.checked)} />
        <span>Block overage usage (never spend extra credit)</span>
      </label>

      {ordered.map(t => (
        <LimitCard
          key={t}
          type={t}
          info={rateLimits[t]}
          window={windowUse[t]}
          cap={caps[t]}
          onCapChange={(v) => window.claudigotchi?.setLimitCaps({ [t]: v })}
          onResetWindow={() => window.claudigotchi?.resetWindowUsage(t)}
        />
      ))}

      {s && (
        <div style={U.sessionCard}>
          <div style={U.sessionHead}>
            <span>This session</span>
            <button style={U.resetBtn} onClick={onResetUsage}>reset</button>
          </div>
          <div style={U.statGrid}>
            <Stat label="turns"      val={s.turns} />
            <Stat label="in tokens"  val={fmtN(s.tokensIn)} />
            <Stat label="out tokens" val={fmtN(s.tokensOut)} />
            <Stat label="cache read" val={fmtN(s.cacheRead)} />
            <Stat label="cache new"  val={fmtN(s.cacheCreation)} />
            <Stat label="cost"       val={`$${(s.costUsd || 0).toFixed(4)}`} highlight />
          </div>
        </div>
      )}
    </div>
  );
}

function LimitCard({ type, info, window: w, cap, onCapChange, onResetWindow }) {
  const messages = w?.messages ?? 0;
  const tokens   = (w?.tokensIn ?? 0) + (w?.tokensOut ?? 0);
  const pct      = cap > 0 ? Math.min(100, Math.round((messages / cap) * 100)) : 0;
  const barColor = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#ffd166' : '#7c3aed';
  const hasInfo  = !!info;

  return (
    <div style={U.limitCard}>
      <div style={U.limitHead}>
        <span style={U.limitName}>{prettyLimitName(type)}</span>
        {hasInfo
          ? <span style={{ ...U.limitStatus, color: statusColor(info) }}>
              {info.isUsingOverage ? '⚠ using overage' : info.status || 'allowed'}
            </span>
          : <span style={{ ...U.limitStatus, color: '#555' }}>no events yet</span>}
      </div>

      {/* Usage bar */}
      <div style={U.usageRow}>
        <div style={U.usageTrack}>
          <div style={{ ...U.usageFill, width: `${pct}%`, background: barColor }} />
        </div>
        <span style={U.usageText}>{pct}%</span>
      </div>

      <div style={U.statRow}>
        <span style={U.statText}>
          <b>{messages}</b> / <CapInput value={cap} onChange={onCapChange} /> messages
        </span>
        <span style={U.statText}>{fmtN(tokens)} tokens</span>
        <button style={U.smallReset} onClick={onResetWindow} title="Zero my local counter for this window">reset</button>
      </div>

      <div style={U.resetRow}>
        <span style={U.resetLabel}>resets</span>
        <Countdown ts={info?.resetsAt || w?.resetsAt} />
      </div>
      {info?.overageResetsAt && (
        <div style={U.resetRow}>
          <span style={U.resetLabel}>overage resets</span>
          <Countdown ts={info.overageResetsAt} />
        </div>
      )}
      {hasInfo && (
        <div style={U.overageState}>
          overage: <b style={{ color: overageColor(info) }}>{info.overageStatus || 'unknown'}</b>
        </div>
      )}
    </div>
  );
}

function CapInput({ value, onChange }) {
  return (
    <input
      type="number"
      min={1}
      value={value}
      onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) onChange?.(v); }}
      style={U.capInput}
      title="Estimated cap. Adjust to match your plan. Pro≈45, Max 5x≈225, Max 20x≈900 messages per 5h."
    />
  );
}

function Stat({ label, val, highlight }) {
  return (
    <div style={U.stat}>
      <div style={U.statLabel}>{label}</div>
      <div style={{ ...U.statVal, color: highlight ? '#ffd166' : '#ddd' }}>{val}</div>
    </div>
  );
}

function Countdown({ ts }) {
  if (!ts) return <span style={U.muted}>—</span>;
  const ms = (ts * 1000) - Date.now();
  if (ms <= 0) return <span style={U.muted}>any moment</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span style={U.muted}>in {h}h {m}m</span>;
}

function prettyLimitName(t) {
  if (!t) return 'Rate limit';
  return { five_hour: '5-hour limit', weekly: 'Weekly limit', daily: 'Daily limit' }[t] || t;
}

function statusColor(r) {
  if (r.isUsingOverage) return '#ffd166';
  if (r.status === 'throttled' || r.status === 'exceeded') return '#e74c3c';
  return '#7fffd4';
}

function overageColor(r) {
  if (r.overageStatus === 'disabled') return '#888';
  if (r.overageStatus === 'allowed')  return '#7fffd4';
  return '#ffd166';
}

function fmtN(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)   + 'k';
  return String(n);
}

const U = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: 12 },
  toggleRow:  { display: 'flex', alignItems: 'center', gap: 8, color: '#ddd', fontSize: 12 },
  empty:      { color: '#555', fontSize: 11, fontStyle: 'italic' },
  limitCard:  { background: '#0a0a0f', border: '1px solid #1a1a22', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 },
  limitHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  limitName:  { fontSize: 12, color: '#ddd', fontWeight: 600 },
  limitStatus:{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  resetRow:   { display: 'flex', gap: 8, fontSize: 11 },
  resetLabel: { color: '#777', width: 100 },
  overageState: { fontSize: 11, color: '#888', marginTop: 4 },
  sessionCard: { background: '#0a0a0f', border: '1px solid #1a1a22', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  sessionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  resetBtn:   { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer' },
  statGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  stat:       { background: '#0e0e14', border: '1px solid #1a1a22', borderRadius: 6, padding: '6px 8px' },
  statLabel:  { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  statVal:    { fontSize: 13, fontFamily: 'Consolas, monospace', marginTop: 2 },
  muted:      { color: '#aaa', fontFamily: 'Consolas, monospace', fontSize: 11 },
  usageRow:   { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 },
  usageTrack: { flex: 1, height: 8, background: '#0a0a0f', border: '1px solid #1a1a22', borderRadius: 4, overflow: 'hidden' },
  usageFill:  { height: '100%', transition: 'width 0.4s ease' },
  usageText:  { fontSize: 11, fontFamily: 'Consolas, monospace', color: '#bbb', width: 36, textAlign: 'right' },
  statRow:    { display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#aaa', flexWrap: 'wrap' },
  statText:   { fontFamily: 'Consolas, monospace' },
  smallReset: { background: 'transparent', border: '1px solid #2a2a2a', color: '#666', padding: '1px 6px', borderRadius: 3, fontSize: 9, cursor: 'pointer', marginLeft: 'auto' },
  capInput:   { width: 50, background: '#0a0a0f', border: '1px solid #2a2a2a', color: '#ddd', borderRadius: 3, padding: '0 4px', fontFamily: 'Consolas, monospace', fontSize: 11, textAlign: 'right' },
};

function Section({ label, children }) {
  return (
    <div style={S.section}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { width: 480, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', background: '#111', border: '1px solid #222', borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:   { fontSize: 16, color: '#eee', margin: 0 },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  label:   { fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1 },
  row:     { display: 'flex', gap: 6, flexWrap: 'wrap' },
  choice:  { padding: '6px 14px', background: '#15151b', border: '1px solid #222', color: '#aaa', borderRadius: 8, cursor: 'pointer', fontSize: 12 },
  choiceActive: { background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 12 },
  note:    { color: '#888', fontSize: 12, lineHeight: 1.6 },
  code:    { background: '#0a0a0f', padding: '1px 6px', borderRadius: 4, color: '#cfcfcf', fontFamily: 'Consolas, monospace', fontSize: 11 },
};
