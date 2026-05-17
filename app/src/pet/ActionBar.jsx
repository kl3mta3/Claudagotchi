export function ActionBar({ onFeed, onClean, onNap, onWake, onShop, onGames, disabled, stage, isNapping = false, onTogglePickup, pickupMode = false, only = null }) {
  const adolescentOrUp = stage >= 2;
  // `only` lets a parent render just one group (used by PetPanel for the
  // side dock 4-row layout — trash + groupA on row 3, groupB on row 4).
  const groupA = (
    <>
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
    </>
  );
  const groupB = (
    <>
      {isNapping
        ? <Btn label="☀️ Wake" onClick={onWake} disabled={disabled} title="Wake your pet up early — the well-rested buff still applies" />
        : <Btn label="😴 Nap"  onClick={onNap}  disabled={disabled || stage < 1} title="Walk to bed (or nap in place), recover sleepiness, get a well-rested buff for ~10 min" />}
      <Btn label="🛍️ Shop" onClick={onShop}  disabled={disabled || !adolescentOrUp} title={!adolescentOrUp ? 'Unlocks at Adolescent' : ''} />
      <Btn label="🎮 Games" onClick={onGames} disabled={disabled || stage < 1 || isNapping} />
    </>
  );
  if (only === 'a') return <div style={S.wrap}>{groupA}</div>;
  if (only === 'b') return <div style={S.wrap}>{groupB}</div>;
  return <div style={S.wrap}>{groupA}{groupB}</div>;
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
  // Single row, no wrap. Top/bottom/pop-out have plenty of width; side dock
  // is narrow but the row scrolls horizontally if it has to. Buttons stay
  // pill-shaped, not crammed into a 6-square grid.
  wrap: { display: 'flex', flexWrap: 'nowrap', gap: 4, padding: '4px 6px' },
  btn:  { padding: '4px 8px', background: '#15151b', border: '1px solid #222', color: '#bbb', borderRadius: 6, fontSize: 10, fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
};
