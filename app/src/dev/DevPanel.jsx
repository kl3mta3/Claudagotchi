import { useEffect, useState } from 'react';

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
  onForceHatch, onForceEvolve, onForceDeath, onNewPet,
  onAddTokens, onWipeSave,
}) {
  // Local mirror so sliders feel snappy; flush on change.
  const [local, setLocal] = useState(tuning);
  useEffect(() => { setLocal(tuning); }, [tuning]);

  function setKnob(k, v) {
    const next = { ...local, [k]: v };
    setLocal(next);
    onTuningChange?.({ [k]: v });
  }

  if (!open) return null;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>🛠 Dev Tools</h2>
          <span style={S.warn}>temporary — will be removed before ship</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>
          <Section title={`Pet — currently ${stageName || '?'} (stage ${stage}) · 🪙 ${tokens} · INT ${Math.floor(intelligence || 0)}`}>
            <div style={S.btnRow}>
              <Btn label="🥚 New Pet (full reset)" onClick={onNewPet} danger />
              <Btn label="🐣 Force Hatch"   onClick={onForceHatch}  disabled={stage !== 0} />
              <Btn label="⚡ Force Evolve" onClick={onForceEvolve} disabled={stage >= 3 || stage === 4} />
              <Btn label="💀 Force Death"  onClick={onForceDeath}  disabled={stage === 4} danger />
            </div>
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

          <Section title="Danger zone">
            <div style={S.btnRow}>
              <Btn label="💣 Wipe save.json + restart pet" onClick={onWipeSave} danger />
            </div>
          </Section>
        </div>
      </div>
    </div>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  panel:   { width: 560, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#0e0e14', border: '1px solid #2a2a3a', borderRadius: 14, overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #1f1f28' },
  title:   { fontSize: 15, color: '#eee', margin: 0 },
  warn:    { flex: 1, fontSize: 10, color: '#ffd166', fontStyle: 'italic' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  body:    { flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 11, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 },
  btnRow:  { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btn:     { padding: '6px 12px', background: '#15151b', border: '1px solid #2a2a3a', color: '#ddd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' },
  btnDanger:{ background: '#2a0f0f', borderColor: '#5a2a2a', color: '#ff8d8d' },
  knob:    { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' },
  knobHead:{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  knobLabel:{ fontSize: 11, color: '#bbb' },
  knobValue:{ fontSize: 11, color: '#7c3aed', fontFamily: 'Consolas, monospace', fontWeight: 700 },
  slider:  { width: '100%', accentColor: '#7c3aed' },
  hint:    { fontSize: 9, color: '#666', fontStyle: 'italic' },
  thresholds: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#bbb' },
};
