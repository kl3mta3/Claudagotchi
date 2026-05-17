export function ActionBar({ onFeed, onClean, onNap, onWake, onShop, onGames, disabled, stage, isNapping = false, onTogglePickup, pickupMode = false }) {
  const adolescentOrUp = stage >= 2;
  // Play removed — owned toys (ball, doll, plushie, instruments) are now
  // clickable directly in the environment for their respective interactions.
  return (
    <div style={S.wrap}>
      <Btn label="🍖 Feed"  onClick={onFeed}  disabled={disabled || stage < 1 || isNapping} />
      <Btn label="🧼 Clean" onClick={onClean} disabled={disabled || isNapping} />
      {onTogglePickup && (
        <Btn
          label={pickupMode ? '🧤 ✓' : '🧤 Pick up'}
          onClick={onTogglePickup}
          disabled={disabled}
          title="Toggle pickup mode — drag poops to the 🗑️"
          active={pickupMode}
        />
      )}
      {isNapping
        ? <Btn label="☀️ Wake" onClick={onWake} disabled={disabled} title="Wake your pet up early — the well-rested buff still applies" />
        : <Btn label="😴 Nap"  onClick={onNap}  disabled={disabled || stage < 1} title="Walk to bed (or nap in place), recover sleepiness, get a well-rested buff for ~10 min" />}
      <Btn label="🛍️ Shop" onClick={onShop}  disabled={disabled || !adolescentOrUp} title={!adolescentOrUp ? 'Unlocks at Adolescent' : ''} />
      <Btn label="🎮 Games" onClick={onGames} disabled={disabled || stage < 1 || isNapping} />
    </div>
  );
}

function Btn({ label, onClick, disabled, title, active }) {
  return (
    <button style={{
              ...S.btn,
              opacity: disabled ? 0.35 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              ...(active ? { background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' } : {}),
            }}
            onClick={onClick} disabled={disabled} title={title}>
      {label}
    </button>
  );
}

const S = {
  wrap: { display: 'flex', gap: 4, padding: '4px 6px', flexWrap: 'wrap' },
  btn:  { padding: '4px 8px', background: '#15151b', border: '1px solid #222', color: '#bbb', borderRadius: 6, fontSize: 10, fontFamily: 'inherit' },
};
