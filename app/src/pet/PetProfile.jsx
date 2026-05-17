import { PetCanvas } from './PetCanvas.jsx';
import { StatBars } from './StatBars.jsx';
import { PERSONALITIES } from '../engine/Personalities.js';

/**
 * PetProfile.jsx
 * Modal showing the pet's bio + stats + equipment, with a special "first
 * reveal" mode that opens once on Egg → Hatchling hatch.
 */
export function PetProfile({
  open, onClose,
  petAppearance, petName, stage = 1, stageName,
  stats, intelligence = 0, evoState,
  born, personalityKey, bio, quirks = [], catchphrase,
  equipped = [], owned = [],
  isFirstReveal = false,
}) {
  if (!open) return null;
  const personality = PERSONALITIES[personalityKey] || {};
  const daysAlive = born ? Math.max(0, Math.floor((Date.now() - new Date(born).getTime()) / 86_400_000)) : 0;

  const evoScore  = evoState?.evolutionScore ?? 0;
  const evoTarget = evoState?.thresholds?.[stage] ?? 100;
  const evoPct = Math.max(0, Math.min(100, (evoScore / Math.max(1, evoTarget)) * 100));

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <button style={S.x} onClick={onClose}>✕</button>

        {/* Sprite */}
        <div style={S.spriteWrap}>
          {petAppearance && (
            <PetCanvas
              appearance={petAppearance}
              stage={stage}
              mood="happy"
              evolutionScore={evoScore}
              clothing={equipped}
              width={260}
              height={160}
            />
          )}
        </div>

        <div style={{ ...S.name, fontFamily: personality.font || 'inherit' }}>
          {petName || '(unnamed)'}
        </div>
        <div style={S.subline}>
          <span>{personality.emoji || '✨'} {personality.label || 'Mysterious'}</span>
          <span style={S.dot}>·</span>
          <span>{stageName || ''}</span>
          {born && <><span style={S.dot}>·</span><span>Born {daysAlive} day{daysAlive === 1 ? '' : 's'} ago</span></>}
        </div>

        {bio && <div style={S.bio}>"{bio}"</div>}
        {catchphrase && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#ffd166', fontStyle: 'italic', marginTop: 4 }}>
            ❝ {catchphrase} ❞
          </div>
        )}
        {Array.isArray(quirks) && quirks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 4 }}>
            {quirks.map((q, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 8px', background: '#1a1a2a', borderRadius: 999, color: '#bbb' }}>
                {q}
              </span>
            ))}
          </div>
        )}

        <div style={S.row}>
          <div style={S.col}>
            <div style={S.colLabel}>Stats</div>
            <StatBars stats={stats} />
          </div>
          <div style={S.col}>
            <div style={S.colLabel}>Intelligence</div>
            <div style={S.intelNum}>{Math.floor(intelligence)}</div>
            <div style={S.colLabel}>Evolution</div>
            <div style={S.evoTrack}><div style={{ ...S.evoFill, width: `${evoPct}%` }} /></div>
          </div>
        </div>

        {equipped.length > 0 && (
          <div style={S.equippedRow}>
            <div style={S.colLabel}>Equipped</div>
            <div style={S.chips}>
              {equipped.map((it, i) => (
                <span key={i} style={S.chip}>{it.emoji || '👕'} {it.name || it.id}</span>
              ))}
            </div>
          </div>
        )}

        {owned.length > 0 && (
          <div style={S.equippedRow}>
            <div style={S.colLabel}>Owned</div>
            <div style={S.emojiRow}>
              {owned.map((it, i) => <span key={i} title={it.name || it.id} style={S.ownedEmoji}>{it.emoji || '📦'}</span>)}
            </div>
          </div>
        )}

        <button style={isFirstReveal ? S.helloBtn : S.closeBtn} onClick={onClose}>
          {isFirstReveal ? '✨ Hello!' : 'Close'}
        </button>
      </div>
    </div>
  );
}

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  panel:      { position: 'relative', width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: '#121218', border: '1px solid #2a2a3a', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 },
  x:          { position: 'absolute', top: 10, right: 12, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  spriteWrap: { position: 'relative', height: 160, background: 'linear-gradient(180deg, #1a1a2a 0%, #14141d 100%)', borderRadius: 10, overflow: 'hidden', border: '1px solid #1a1a22' },
  name:       { fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center', marginTop: 8 },
  subline:    { display: 'flex', justifyContent: 'center', gap: 6, color: '#aaa', fontSize: 11 },
  dot:        { color: '#444' },
  bio:        { fontStyle: 'italic', color: '#ccc', fontSize: 13, lineHeight: 1.5, background: '#0c0c12', padding: '10px 12px', borderRadius: 8, border: '1px solid #1a1a22', textAlign: 'center' },
  row:        { display: 'flex', gap: 12 },
  col:        { flex: 1, background: '#0c0c12', border: '1px solid #1a1a22', borderRadius: 8, padding: 8 },
  colLabel:   { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  intelNum:   { fontSize: 22, fontWeight: 700, color: '#6c63ff', fontFamily: 'Consolas, monospace', marginBottom: 10 },
  evoTrack:   { height: 8, background: '#15151b', border: '1px solid #1a1a22', borderRadius: 4, overflow: 'hidden' },
  evoFill:    { height: '100%', background: 'linear-gradient(90deg, #6c63ff, #5dade2)', transition: 'width 0.4s ease' },
  equippedRow:{ display: 'flex', flexDirection: 'column', gap: 4, background: '#0c0c12', border: '1px solid #1a1a22', borderRadius: 8, padding: 8 },
  chips:      { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip:       { padding: '3px 8px', background: '#1a1a22', border: '1px solid #2a2a3a', borderRadius: 999, fontSize: 11, color: '#ddd' },
  emojiRow:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
  ownedEmoji: { fontSize: 18 },
  helloBtn:   { padding: '12px 18px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  closeBtn:   { padding: '10px 18px', background: '#1a1a22', color: '#ccc', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 13, cursor: 'pointer', marginTop: 6 },
};
