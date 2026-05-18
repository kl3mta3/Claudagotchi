import { useMemo, useState } from 'react';
import { PetCanvas } from '../pet/PetCanvas.jsx';
import { generatePet, randomSeed } from '../engine/PetGenerator.js';
import { SHOP_ITEMS, ITEM_CATEGORIES } from '../shop/ShopItems.js';

/**
 * SpriteGallery — internal QA harness. Renders every body × every clothing
 * item in a grid so we can audit the whole sprite catalog at a glance.
 *
 * Modes:
 *   "shapes"   — one card per body shape (cycles ears + tails); all stages
 *   "clothing" — one card per clothing item, on a fixed adult body
 *   "random"   — N random fresh pets, all stages side by side
 *
 * Opened via the DEV tools button → "Sprite Gallery". Skipped from prod
 * users (the DEV button is hidden by default — see /vedamat toggle).
 */
const BODY_SHAPES = ['round', 'chunky', 'slim', 'wide', 'petite'];
const EAR_TYPES   = ['round', 'pointy', 'floppy', 'tufted', 'none'];
const TAIL_TYPES  = ['stubby', 'long', 'curly', 'puff', 'none'];
const MOODS       = ['idle', 'happy', 'eating', 'sleeping', 'shower', 'thinking', 'sad', 'dead'];
const STAGES      = [
  { stage: 0, label: 'Egg' },
  { stage: 1, label: 'Hatchling' },
  { stage: 2, label: 'Adolescent' },
  { stage: 3, label: 'Adult' },
];

const FIXED_SEED = 0xC0FFEE;

export function SpriteGallery({ open, onClose }) {
  const [mode, setMode] = useState('shapes');     // shapes | clothing | random | moods
  const [stage, setStage] = useState(3);
  const [seedSalt, setSeedSalt] = useState(0);    // bump to re-roll random
  const [mood, setMood] = useState('idle');

  if (!open) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>🎨 Sprite Gallery</h2>
          <div style={S.tabs}>
            {['shapes','clothing','moods','random'].map(m => (
              <button key={m} style={{ ...S.tab, ...(mode === m ? S.tabActive : {}) }}
                      onClick={() => setMode(m)}>{m}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <select value={stage} onChange={e => setStage(parseInt(e.target.value, 10))} style={S.select}>
            {STAGES.map(s => <option key={s.stage} value={s.stage}>{s.label}</option>)}
          </select>
          {mode === 'moods' && (
            <select value={mood} onChange={e => setMood(e.target.value)} style={S.select}>
              {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {mode === 'random' && (
            <button style={S.btn} onClick={() => setSeedSalt(s => s + 1)}>↻ Re-roll</button>
          )}
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>
          {mode === 'shapes' && <ShapesGrid stage={stage} />}
          {mode === 'clothing' && <ClothingGrid stage={stage} />}
          {mode === 'moods' && <MoodsGrid stage={stage} mood={mood} />}
          {mode === 'random' && <RandomGrid stage={stage} salt={seedSalt} />}
        </div>
      </div>
    </div>
  );
}

/** One card per body shape × ear type × tail type (clipped to keep it sane). */
function ShapesGrid({ stage }) {
  const cards = [];
  for (const body of BODY_SHAPES) {
    for (const ear of EAR_TYPES) {
      for (const tail of TAIL_TYPES) {
        cards.push({ body, ear, tail });
      }
    }
  }
  return (
    <div style={S.grid}>
      {cards.map((c, i) => {
        const seed = (FIXED_SEED ^ (i * 0x1234567)) >>> 0;
        const pet = generatePet(seed);
        // Override the generated traits with this card's combo
        pet.adult.bodyShape = c.body;
        pet.adult.earType   = c.ear;
        pet.adult.tailType  = c.tail;
        pet.adolescent.bodyShape = c.body;
        pet.adolescent.earType   = c.ear;
        pet.adolescent.tailType  = c.tail;
        return (
          <SpriteCard key={i} title={`${c.body}/${c.ear}/${c.tail}`} pet={pet} stage={stage} />
        );
      })}
    </div>
  );
}

/** One card per clothing item, equipped on a fixed adult body. */
function ClothingGrid({ stage }) {
  const items = SHOP_ITEMS.filter(it => it.category === ITEM_CATEGORIES.CLOTHING);
  const basePet = useMemo(() => generatePet(FIXED_SEED), []);
  return (
    <div style={S.grid}>
      <SpriteCard title="(no clothing)" pet={basePet} stage={stage} clothing={[]} />
      {items.map(it => (
        <SpriteCard
          key={it.id}
          title={`${it.emoji ?? ''} ${it.name}`}
          subtitle={`slot: ${it.slot || '?'}`}
          pet={basePet}
          stage={stage}
          clothing={[{ id: it.id, slot: it.slot, name: it.name }]}
        />
      ))}
    </div>
  );
}

/** One card per mood, fixed body. */
function MoodsGrid({ stage, mood }) {
  const pet = useMemo(() => generatePet(FIXED_SEED), []);
  return (
    <div style={S.grid}>
      {MOODS.map(m => (
        <SpriteCard key={m} title={m} highlight={m === mood} pet={pet} stage={stage} mood={m} />
      ))}
    </div>
  );
}

/** 24 random fresh pets — re-rolls with salt bump. */
function RandomGrid({ stage, salt }) {
  const pets = useMemo(() => {
    const out = [];
    for (let i = 0; i < 24; i++) out.push(generatePet(randomSeed() ^ salt));
    return out;
  }, [salt]);
  return (
    <div style={S.grid}>
      {pets.map((p, i) => (
        <SpriteCard key={i} title={`#${p.seed.toString(16)}`} pet={p} stage={stage} />
      ))}
    </div>
  );
}

function SpriteCard({ title, subtitle, pet, stage, clothing = [], mood = 'idle', highlight = false }) {
  return (
    <div style={{ ...S.card, ...(highlight ? { outline: '2px solid #6c63ff' } : {}) }}>
      <div style={S.cardCanvas}>
        <PetCanvas
          appearance={pet}
          stage={stage}
          mood={mood}
          evolutionScore={50}
          clothing={clothing}
          width={140}
          height={140}
        />
      </div>
      <div style={S.cardTitle}>{title}</div>
      {subtitle && <div style={S.cardSub}>{subtitle}</div>}
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  panel:   { width: '94vw', height: '90vh', background: '#0a0a0f', border: '1px solid #2a2a3a', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1f1f28', background: '#0e0e14', flexShrink: 0 },
  title:   { fontSize: 14, color: '#eee', margin: 0 },
  tabs:    { display: 'flex', gap: 4, marginLeft: 8 },
  tab:     { padding: '4px 10px', background: '#15151b', border: '1px solid #2a2a3a', color: '#bbb', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' },
  tabActive:{ background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  select:  { padding: '4px 8px', background: '#15151b', color: '#ddd', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 11, fontFamily: 'inherit' },
  btn:     { padding: '4px 10px', background: '#15151b', border: '1px solid #2a2a3a', color: '#bbb', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  close:   { background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: 16, padding: '0 6px' },
  body:    { flex: 1, overflowY: 'auto', padding: 14 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 },
  card:    { background: '#0e0e14', border: '1px solid #1a1a22', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  cardCanvas: { position: 'relative', width: 140, height: 140, background: '#06060a', borderRadius: 4, overflow: 'hidden' },
  cardTitle: { fontSize: 10, color: '#bbb', textAlign: 'center', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSub:  { fontSize: 9, color: '#666', textAlign: 'center' },
};
