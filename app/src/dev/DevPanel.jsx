import { useEffect, useRef, useState } from 'react';
import { SpriteGallery } from './SpriteGallery.jsx';

/**
 * DevPanel — temporary developer tooling. Force evolution/death/hatch,
 * tune decay + token rates, dump or wipe save. Open via the DEV button in
 * the title bar.
 *
 * Props:
 *   open, onClose
 *   stage, stageName
 *   tuning           — current PetEngine tuning snapshot
 *   onTuningChange   — (patch) => void
 *   evoThresholds    — { 0: N, 1: N, 2: N }
 *   onForceHatch     — () => void
 *   onForceEvolve    — () => void
 *   onForceDeath     — () => void
 *   onNewPet         — () => void
 *   onAddTokens      — (n) => void
 *   onWipeSave       — () => void
 */
export function DevPanel({
  open, onClose,
  stage, stageName,
  tokens, intelligence,
  tuning = {},
  onTuningChange,
  evoThresholds,
  onForceHatch, onForceEvolve, onForceDeath, onNewPet, onForceShiny,
  onAddTokens, onWipeSave,
}) {
  // Local mirror so sliders feel snappy; flush on change.
  const [local, setLocal] = useState(tuning);
  useEffect(() => { setLocal(tuning); }, [tuning]);
  const [showGallery, setShowGallery] = useState(false);

  function setKnob(k, v) {
    const next = { ...local, [k]: v };
    setLocal(next);
    onTuningChange?.({ [k]: v });
  }

  // Left-docked panel with horizontal resize. Width persists across sessions.
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('cg.devPanelWidth') || '0', 10);
    return saved >= 220 && saved <= 600 ? saved : 320;
  });
  useEffect(() => { localStorage.setItem('cg.devPanelWidth', String(width)); }, [width]);
  const draggingRef = useRef(false);
  function onResizeStart(e) {
    e.preventDefault();
    draggingRef.current = true;
    const move = (ev) => {
      if (!draggingRef.current) return;
      setWidth(Math.max(220, Math.min(600, ev.clientX)));
    };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  }

  if (!open) return null;
  return (
    <div style={{ ...S.panel, width }} onClick={e => e.stopPropagation()}>
      <div style={S.header}>
        <h2 style={S.title}>🛠 Dev Tools</h2>
        <button style={S.close} onClick={onClose}>✕</button>
      </div>

      <div style={S.body}>
        <Section title={`Pet — ${stageName || '?'} (stage ${stage})`}>
          <div style={S.statLine}>🪙 {tokens} · INT {Math.floor(intelligence || 0)}</div>
          <div style={S.btnGrid}>
            <Btn label="🥚 New Pet"      onClick={onNewPet}      danger />
            <Btn label="💀 Force Death"  onClick={onForceDeath}  disabled={stage === 4} danger />
            <Btn label="🐣 Force Hatch"  onClick={onForceHatch}  disabled={stage !== 0} />
            <Btn label="⚡ Force Evolve" onClick={onForceEvolve} disabled={stage >= 3 || stage === 4} />
          </div>
          {onForceShiny && (
            <Btn label="✨ Spawn Shiny Egg" onClick={onForceShiny} title="Tombstone current pet, hatch a fresh shiny egg (normally 1% rate)" />
          )}
        </Section>

        <Section title="Sprite QA">
          <Btn label="🎨 Sprite Gallery" onClick={() => setShowGallery(true)} />
        </Section>

          <Section title="Economy">
            <div style={S.btnRow}>
              <Btn label="+100 🪙"  onClick={() => onAddTokens?.(100)} />
              <Btn label="+1k 🪙"   onClick={() => onAddTokens?.(1000)} />
              <Btn label="+10k 🪙"  onClick={() => onAddTokens?.(10000)} />
              <Btn label="+100k 🪙" onClick={() => onAddTokens?.(100000)} />
            </div>
            <Knob label="Token multiplier (×)" value={local.tokenMultiplier ?? 1} min={1} max={50} step={1}
                  onChange={v => setKnob('tokenMultiplier', v)}
                  hint="Multiplies every token reward — useful for fast-testing shop items." />
          </Section>

          <Section title="Stat decay (per 60s tick)">
            <Knob label="Hunger decay"      value={local.hungerDecay ?? 3}    min={0} max={30} step={1}
                  onChange={v => setKnob('hungerDecay', v)}
                  hint="Default: 3. Bump to 30 to see starvation in a few minutes." />
            <Knob label="Cleanliness decay" value={local.cleanlinessDecay ?? 1.5} min={0} max={20} step={0.5}
                  onChange={v => setKnob('cleanlinessDecay', v)} hint="Default: 1.5" />
            <Knob label="Boredom growth"    value={local.boredomDecay ?? 2}   min={0} max={20} step={1}
                  onChange={v => setKnob('boredomDecay', v)} hint="Default: 2 (rises when idle)" />
          </Section>

          <Section title="Death thresholds">
            <Knob label="Ticks at 0 hunger before death" value={local.deathHungerTicks ?? 15} min={1} max={60} step={1}
                  onChange={v => setKnob('deathHungerTicks', v)} hint="Default: 15 (15 minutes of starvation)" />
            <Knob label="Ticks at 0 health before death" value={local.deathHealthTicks ?? 5} min={1} max={60} step={1}
                  onChange={v => setKnob('deathHealthTicks', v)} hint="Default: 5" />
          </Section>

          {evoThresholds && (
            <Section title="Evolution thresholds (current pet)">
              <div style={S.thresholds}>
                <div>Egg → Hatchling: <b>{Math.round(evoThresholds[0])}</b></div>
                <div>Hatchling → Adolescent: <b>{Math.round(evoThresholds[1])}</b></div>
                <div>Adolescent → Adult: <b>{Math.round(evoThresholds[2])}</b></div>
              </div>
              <div style={S.hint}>Use Force Evolve to skip these directly.</div>
            </Section>
          )}

          <LastSendSection />

        <Section title="Danger zone">
          <div style={S.btnRow}>
            <Btn label="💣 Wipe save.json + restart pet" onClick={onWipeSave} danger />
          </div>
        </Section>
        <div style={S.warn}>temporary — will be removed before ship</div>
      </div>
      {/* Resize handle on the right edge — drag to set panel width. */}
      <div style={S.resizeHandle} onPointerDown={onResizeStart} title="Drag to resize" />
      <SpriteGallery open={showGallery} onClose={() => setShowGallery(false)} />
    </div>
  );
}

function LastSendSection() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      const d = await window.claudigotchi?.getLastSendDiagnostics?.();
      if (!cancelled) setData(d);
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return (
    <Section title="Last send (diagnostics)">
      {!data && <div style={{ fontSize: 11, color: '#666' }}>no sends yet — try chatting</div>}
      {data && (
        <pre style={{ background: '#0a0a0f', padding: 8, borderRadius: 6, fontSize: 10, color: '#bbb', overflow: 'auto', margin: 0, lineHeight: 1.4 }}>
{`mode:           ${data.mode || '-'}
model:          ${data.model || 'default'}
permission:     ${data.permissionMode || 'default'}
sessionId:      ${data.sessionId || '(new)'}
requestId:      ${data.requestId || '-'}
message len:    ${data.msgLen} chars
appendSysPrompt:${data.appendSystemPromptLen ? ' ' + data.appendSystemPromptLen + ' chars ✓' : ' (none) ⚠ pet personality NOT injected'}
systemPrompt:   ${data.systemPromptLen ? data.systemPromptLen + ' chars (full override)' : '(none)'}
disallowedTools:${data.disallowedToolsCount ? ' ' + data.disallowedToolsCount + ' tools blocked' : ' (none)'}
last error:     ${data.lastError || '(none)'}
ts:             ${data.ts ? new Date(data.ts).toLocaleTimeString() : '-'}`}
        </pre>
      )}
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        If appendSysPrompt is 0, the pet personality isn't being injected — check engine/PetVoice.js.
      </div>
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Btn({ label, onClick, disabled, danger }) {
  return (
    <button
      style={{ ...S.btn, ...(danger ? S.btnDanger : {}), opacity: disabled ? 0.35 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onClick={onClick}
      disabled={disabled}
    >{label}</button>
  );
}

function Knob({ label, value, min, max, step, onChange, hint }) {
  return (
    <div style={S.knob}>
      <div style={S.knobHead}>
        <span style={S.knobLabel}>{label}</span>
        <span style={S.knobValue}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))}
             style={S.slider} />
      {hint && <div style={S.hint}>{hint}</div>}
    </div>
  );
}

const S = {
  // Lives as its OWN column inside the main flex row — pushes the sidebar
  // (and everything to the right) over instead of overlaying them. Width is
  // controlled by local state; resize handle on the right edge.
  panel:   { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: '#0e0e14', borderRight: '1px solid #2a2a3a', flexShrink: 0 },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1f1f28', flexShrink: 0 },
  title:   { fontSize: 13, color: '#eee', margin: 0, flex: 1 },
  warn:    { fontSize: 9, color: '#ffd166', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  body:    { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionTitle: { fontSize: 10, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 },
  statLine:{ fontSize: 10, color: '#999', fontFamily: 'Consolas, monospace' },
  btnRow:  { display: 'flex', gap: 6, flexWrap: 'wrap' },
  // 2-column grid for the pet-action quartet: New Pet | Force Death  /  Hatch | Evolve
  btnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  btn:     { padding: '6px 10px', background: '#15151b', border: '1px solid #2a2a3a', color: '#ddd', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnDanger:{ background: '#2a0f0f', borderColor: '#5a2a2a', color: '#ff8d8d' },
  knob:    { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' },
  knobHead:{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  knobLabel:{ fontSize: 11, color: '#bbb' },
  knobValue:{ fontSize: 11, color: '#7c3aed', fontFamily: 'Consolas, monospace', fontWeight: 700 },
  slider:  { width: '100%', accentColor: '#7c3aed' },
  hint:    { fontSize: 9, color: '#666', fontStyle: 'italic' },
  thresholds: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#bbb' },
  resizeHandle: { position: 'absolute', top: 0, right: -3, width: 6, height: '100%', cursor: 'ew-resize', background: 'transparent', zIndex: 201 },
};
