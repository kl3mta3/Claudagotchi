/**
 * Environment.jsx
 * Side-view 2D room. Renders wallpaper, floor, furniture (from inventory),
 * code bugs (errors), bouncing toys, and a slot for PetCanvas to render the pet on top.
 */

import { useEffect, useRef, useState } from 'react';

// Floor takes up the bottom half of the env. PetCanvas reads this so the
// walking AI keeps the pet's feet inside the floor visual.
export const FLOOR_RATIO = 0.5;

const WALLPAPERS = {
  default:              { wall: 'linear-gradient(180deg, #1a1a2a 0%, #14141d 100%)', floor: '#2a2a3a' },
  wallpaper_forest:     { wall: 'linear-gradient(180deg, #1a3a2a 0%, #0d2218 100%)', floor: '#1a1208' },
  wallpaper_space:      { wall: 'radial-gradient(circle at 30% 20%, #1a1a4a 0%, #050518 70%)', floor: '#06061a' },
  wallpaper_cabin:      { wall: 'linear-gradient(180deg, #3a2a1a 0%, #2a1808 100%)', floor: '#1f1208' },
  wallpaper_sunset:     { wall: 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 60%, #5f3a82 100%)', floor: '#3a1f2a' },
  wallpaper_ocean:      { wall: 'linear-gradient(180deg, #0a4a6a 0%, #1e88a8 60%, #66c2c5 100%)', floor: '#062a3a' },
  wallpaper_rainbow:    { wall: 'linear-gradient(180deg, #ff595e 0%, #ffca3a 25%, #8ac926 50%, #1982c4 75%, #6a4c93 100%)', floor: '#1a1a2a', anim: 'cgRainbowShift 12s ease-in-out infinite' },
  wallpaper_grid:       { wall: '#0a0e1a', floor: '#080a14', overlay: 'grid' },
  wallpaper_blueprint:  { wall: '#1a3a6a', floor: '#0a2240', overlay: 'blueprint' },
};

// Foreground borders draw on top of the floor band, below the pet.
const FOREGROUNDS = {
  border_grass:   { color: '#2ecc71', kind: 'grass_carpet' },
  border_sand:    { color: '#f4d28a', kind: 'sand' },
  border_flowers: { color: '#e74c3c', kind: 'flowers' },
  border_tile:    {                   kind: 'tile' },
  border_wood:    {                   kind: 'wood' },
  // border_beach removed in Phase 10 (was redundant with border_sand)
};

// Per-id default positioning. Users can drag to reposition; persisted via
// furniturePositions in save. left/top are % strings, bottom is px from floor.
const FURNITURE_POS = {
  fancy_bed:       { left: '82%', bottom: 14, size: 40 },
  pet_bed:         { left: '82%', bottom: 14, size: 40 },
  shower_head:     { left: '92%', top: 6,     size: 32 },
  pet_pc:          { left: '60%', top: '38%', size: 30 },
  food_tray:       { left: '52%', bottom: 14, size: 34 },
  table:           { left: '50%', bottom: 14, size: 36 },
  aquarium:        { left: '5%',  top: '24%', size: 28 },
  bookshelf:       { left: '8%',  bottom: 14, size: 28 },
  whiteboard:      { left: '22%', top: '18%', size: 28 },
  tv:              { left: '35%', top: '24%', size: 28 },
  plant:           { left: '95%', bottom: 14, size: 26 },
  second_monitor:  { left: '68%', top: '30%', size: 26 },
  microphone:      { left: '42%', bottom: 14, size: 24 },
  guitar:          { left: '18%', bottom: 14, size: 28 },
  piano:           { left: '28%', bottom: 14, size: 32 },
  drum_kit:        { left: '72%', bottom: 14, size: 30 },
  turntable:       { left: '38%', bottom: 14, size: 26 },
  plushie:         { left: '94%', bottom: 14, size: 22 },
  doll:            { left: '10%', bottom: 14, size: 20 },
  squeaky_toy:     { left: '88%', bottom: 14, size: 20 },
  // Background props — sit on the wall above the floor
  prop_window:     { left: '20%', top: '12%', size: 32 },
  prop_picture:    { left: '50%', top: '10%', size: 24 },
  prop_clock:      { left: '74%', top: '8%',  size: 26 },
  prop_shelf:      { left: '40%', top: '24%', size: 22 },
  prop_neon_sign:  { left: '64%', top: '14%', size: 30 },
  wall_horizontal: { left: '50%', bottom: 14,  size: 80 },
  wall_vertical:   { left: '50%', top: '40%',  size: 48 },
};

const SPRITES = {
  fancy_bed:       '🛏️',
  pet_bed:         '🛏️',
  aquarium:        '🐠',
  second_monitor:  '🖥️',
  bookshelf:       '📚',
  whiteboard:      '🪧',
  food_tray:       '🍽',
  // Tables: no good unicode emoji exists (🪑 is a chair, 🛋️ is a couch).
  // Rendered as inline SVG in FurnitureSprite via the SPRITE_SVG map below.
  table:           '__svg__',
  pet_pc:          '💻',
  tv:              '📺',
  plant:           '🪴',
  shower_head:     '🚿',
  guitar:          '🎸',
  piano:           '🎹',
  drum_kit:        '🥁',
  microphone:      '🎤',
  turntable:       '🎛️',
  doll:            '🪆',
  plushie:         '🧸',
  squeaky_toy:     '🦴',
  rubber_ball:     '⚽',
  prop_window:     '🪟',
  prop_picture:    '🖼️',
  prop_clock:      '🕰️',
  prop_shelf:      '🪜',
  prop_neon_sign:  '__svg__',
  aquarium:        '__svg__',
  wall_horizontal: '__svg__',
  wall_vertical:   '__svg__',
};

export function Environment({
  housing, furniture = [], bugs = 0, children, height = 140,
  fedItemEmoji = null, showerActive = false,
  hasBall = false,
  furniturePositions = {}, onFurnitureMove,
  poops = [],
  foreground = null,
  onToyInteract = null,
  onTrashItem = null,
  trashRectRef = null,
  pickupMode = false,
  onPoopRemove = null,
}) {
  const w = WALLPAPERS[housing] || WALLPAPERS.default;
  const bugCount = Math.min(12, bugs || 0);
  const fg = foreground ? FOREGROUNDS[foreground] : null;

  return (
    <div style={{
      position: 'relative',
      height,
      background: w.wall,
      animation: w.anim,
      backgroundSize: w.anim ? '100% 300%' : undefined,
      overflow: 'hidden',
      borderRadius: 6,
      border: '1px solid #1a1a22',
    }}>
      {/* Wallpaper overlays — grid, blueprint lines, etc. */}
      {w.overlay === 'grid' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(108,99,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.18) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }} />
      )}
      {w.overlay === 'blueprint' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.13) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }} />
      )}
      {housing === 'wallpaper_space' && (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 1 + (i % 3),
              height: 1 + (i % 3),
              background: '#fff',
              opacity: 0.4 + (i % 5) * 0.1,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 31) % 70}%`,
              borderRadius: '50%',
            }} />
          ))}
        </>
      )}

      {/* Floor — now covers the bottom ~50% of the env so the pet has a
          believable "ground plane" to wander on. Foreground (flooring) covers
          the same band. PetCanvas knows about FLOOR_RATIO via getFloorTopPx
          below and constrains the pet's feet to stay inside it. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: `${Math.round(height * FLOOR_RATIO)}px`,
        background: w.floor, borderTop: '1px solid #2a2a3a',
      }} />

      {/* Flooring layer (grass carpet, tile, wood, sand, flowers). Sits on
          top of the base floor color, below the pet. No explicit z-index so
          DOM order keeps the pet above it. */}
      {fg && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.round(height * FLOOR_RATIO)}px`, pointerEvents: 'none' }}>
          {fg.kind === 'grass_carpet' && (
            <svg width="100%" height="24" viewBox="0 0 100 12" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <rect x="0" y="9" width="100" height="3" fill="#1e7e3f" opacity="0.55" />
              {Array.from({ length: 80 }).map((_, i) => {
                // Mulberry32-style deterministic jitter so it doesn't reshuffle every render
                const seed = (i * 1103515245 + 12345) & 0x7fffffff;
                const jx = ((seed >>> 4) & 0x3f) / 64;
                const jh = 4 + (((seed >>> 10) & 0xf) / 16) * 3;     // 4..7
                const jw = 0.5 + (((seed >>> 16) & 0x3) / 4) * 0.4;
                const tilt = (((seed >>> 8) & 1) ? 1 : -1) * 0.3;
                const x = i * 1.25 + jx * 0.6;
                const color = (i % 7 === 0) ? '#28a14a' : (i % 5 === 0) ? '#3ddb6a' : '#2ecc71';
                return (
                  <polygon
                    key={i}
                    points={`${x - jw},12 ${x + tilt},${12 - jh} ${x + jw},12`}
                    fill={color}
                  />
                );
              })}
            </svg>
          )}
          {fg.kind === 'tile' && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(45deg, #6b6b75 25%, transparent 25%, transparent 75%, #6b6b75 75%), linear-gradient(45deg, #6b6b75 25%, #2a2a32 25%, #2a2a32 75%, #6b6b75 75%)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px',
              borderTop: '1px solid #1a1a22',
            }} />
          )}
          {fg.kind === 'wood' && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(90deg, #6b4520 0px, #6b4520 38px, #5a3818 38px, #5a3818 40px), repeating-linear-gradient(0deg, transparent 0px, transparent 7px, rgba(0,0,0,0.18) 7px, rgba(0,0,0,0.18) 8px)',
              borderTop: '1px solid #2a1a08',
            }}>
              {/* knots */}
              <div style={{ position: 'absolute', left: '18%', top: 4, width: 5, height: 3, borderRadius: '50%', background: '#3a2410', opacity: 0.8 }} />
              <div style={{ position: 'absolute', left: '62%', top: 13, width: 6, height: 4, borderRadius: '50%', background: '#3a2410', opacity: 0.8 }} />
              <div style={{ position: 'absolute', left: '84%', top: 6,  width: 4, height: 3, borderRadius: '50%', background: '#3a2410', opacity: 0.8 }} />
            </div>
          )}
          {fg.kind === 'sand' && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: fg.color, opacity: 0.85 }} />
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ position: 'absolute', left: `${15 + i * 18}%`, bottom: 4, fontSize: 10 }}>🐚</span>
              ))}
            </>
          )}
          {fg.kind === 'flowers' && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, #2ecc7155)' }} />
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} style={{ position: 'absolute', left: `${(i * 9.3) % 95}%`, bottom: 6, fontSize: 12 }}>{i % 3 === 0 ? '🌸' : i % 3 === 1 ? '🌼' : '🌺'}</span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Furniture */}
      {furniture.map((f, i) => (
        <FurnitureSprite
          key={`${f.id || f}-${i}`}
          item={f}
          fedItemEmoji={fedItemEmoji}
          overridePos={furniturePositions[f.id || f]}
          onMove={onFurnitureMove}
          onToyInteract={onToyInteract}
          onTrashItem={onTrashItem}
          trashRectRef={trashRectRef}
        />
      ))}

      {/* Shower water effect — falls from wherever the shower head currently sits */}
      {showerActive && (() => {
        const showerOverride = furniturePositions['shower_head'];
        const showerXPct = showerOverride?.xPct
          ?? parseFloat(String(FURNITURE_POS.shower_head?.left ?? '92').replace('%', ''));
        const showerTopPx = (showerOverride?.yPct != null)
          ? `calc(${showerOverride.yPct}% + 28px)`
          : 32;
        return (
          <div style={{
            position: 'absolute', left: `${showerXPct}%`, top: showerTopPx,
            transform: 'translateX(-50%)',
            fontSize: 13, opacity: 0.75, lineHeight: 1,
            pointerEvents: 'none',
            animation: 'cgShowerDrops 0.55s linear infinite',
          }}>💧💧💧</div>
        );
      })()}

      {/* Bouncing ball (separate from pet RAF loop) */}
      {hasBall && <BouncingBall onKick={onToyInteract ? () => onToyInteract('rubber_ball') : null} />}

      {/* 💩 Poops on the floor — sit until Clean is run, or drag-to-trash in pickup mode */}
      {poops.map((p) => (
        <DraggablePoop
          key={p.id}
          poop={p}
          pickupMode={pickupMode}
          trashRectRef={trashRectRef}
          onPoopRemove={onPoopRemove}
        />
      ))}

      {/* Bugs */}
      {Array.from({ length: bugCount }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 73 + 13) % 92}%`,
          bottom: 14 + (i % 3) * 4,
          fontSize: 12,
          animation: `cgBug 4s ease-in-out infinite`,
          animationDelay: `${(i * 0.3) % 2}s`,
        }}>🐛</div>
      ))}

      {/* Pet slot */}
      {children}

      <style>{`
        @keyframes cgBug { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
        @keyframes cgShowerDrops { 0%{transform:translateY(0); opacity:0.7} 100%{transform:translateY(12px); opacity:0.1} }
        @keyframes cgRainbowShift { 0%,100% { background-position: 0% 0%; } 50% { background-position: 0% 100%; } }
      `}</style>
    </div>
  );
}

// Inline SVG sprites for items that don't have a good unicode emoji.
// Each takes the requested pixel size and returns an SVG element.
const SPRITE_SVG = {
  table: (size = 36) => (
    <svg width={size} height={size * 0.7} viewBox="0 0 40 28">
      <rect x="2" y="6" width="36" height="6" rx="1.5" fill="#8b5a2b" stroke="#4a2f15" strokeWidth="0.6" />
      <rect x="2" y="6" width="36" height="1.5" fill="#a0703d" />
      <rect x="5"  y="12" width="3" height="14" fill="#6b4520" stroke="#3a2410" strokeWidth="0.4" />
      <rect x="32" y="12" width="3" height="14" fill="#6b4520" stroke="#3a2410" strokeWidth="0.4" />
      <rect x="5" y="11" width="30" height="2" fill="#6b4520" />
    </svg>
  ),
  aquarium: (size = 36) => (
    <svg width={size} height={size * 0.75} viewBox="0 0 40 30">
      <defs>
        <linearGradient id="aqWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#5dade2" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1f618d" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {/* Glass tank */}
      <rect x="2" y="4" width="36" height="22" rx="1" fill="url(#aqWater)" stroke="#aaa" strokeWidth="0.6" />
      {/* Sand at the bottom */}
      <rect x="2" y="22" width="36" height="4" fill="#d4b178" />
      {/* Plants */}
      <path d="M 8 22 Q 10 16 8 10" stroke="#27ae60" strokeWidth="1.4" fill="none" />
      <path d="M 11 22 Q 9 18 12 14"  stroke="#1e8449" strokeWidth="1.2" fill="none" />
      <path d="M 30 22 Q 32 16 30 12" stroke="#27ae60" strokeWidth="1.4" fill="none" />
      {/* Fish */}
      <g>
        <ellipse cx="18" cy="12" rx="3" ry="1.6" fill="#f39c12" />
        <polygon points="15,12 13,11 13,13" fill="#e67e22" />
        <circle cx="19" cy="11.6" r="0.3" fill="#000" />
        <animateTransform attributeName="transform" type="translate" values="0 0;6 1;0 0;-6 -1;0 0" dur="6s" repeatCount="indefinite" />
      </g>
      <g>
        <ellipse cx="26" cy="17" rx="2.5" ry="1.3" fill="#e74c3c" />
        <polygon points="23.5,17 22,16 22,18" fill="#c0392b" />
        <circle cx="27" cy="16.7" r="0.3" fill="#000" />
        <animateTransform attributeName="transform" type="translate" values="0 0;-5 -1;0 0;5 1;0 0" dur="5s" repeatCount="indefinite" />
      </g>
      <g>
        <ellipse cx="14" cy="19" rx="2" ry="1.1" fill="#8e44ad" />
        <polygon points="12,19 10.5,18 10.5,20" fill="#5b2c6f" />
        <animateTransform attributeName="transform" type="translate" values="0 0;4 0.5;0 0;-4 -0.5;0 0" dur="7s" repeatCount="indefinite" />
      </g>
      {/* Bubbles */}
      <circle cx="9" cy="20" r="0.7" fill="#fff" opacity="0.7">
        <animate attributeName="cy" values="22;6;22" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="31" cy="18" r="0.6" fill="#fff" opacity="0.7">
        <animate attributeName="cy" values="22;6;22" dur="4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.7;0" dur="4s" repeatCount="indefinite" />
      </circle>
    </svg>
  ),
  wall_horizontal: (size = 80) => {
    // Brick wall — single course, slim horizontal segment.
    return (
      <svg width={size} height={Math.round(size * 0.15)} viewBox="0 0 80 12" style={{ filter: 'drop-shadow(0 1px 0 #0007)' }}>
        <rect x="0" y="0" width="80" height="12" fill="#7a3b2a" stroke="#3a1a0e" strokeWidth="0.5" />
        {[10, 25, 40, 55, 70].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="12" stroke="#3a1a0e" strokeWidth="0.5" />
        ))}
        <rect x="0" y="0" width="80" height="1.5" fill="#a8584a" opacity="0.6" />
      </svg>
    );
  },
  wall_vertical: (size = 48) => {
    // Brick wall — vertical segment
    const w = Math.round(size * 0.35);
    return (
      <svg width={w} height={size} viewBox="0 0 18 60" style={{ filter: 'drop-shadow(2px 0 0 #0007)' }}>
        <rect x="0" y="0" width="18" height="60" fill="#7a3b2a" stroke="#3a1a0e" strokeWidth="0.6" />
        {/* mortar lines */}
        <line x1="9" y1="0" x2="9" y2="60" stroke="#3a1a0e" strokeWidth="0.6" />
        {/* left column bricks */}
        {[0, 16, 32, 48].map(y => (
          <line key={`l${y}`} x1="0" y1={y} x2="9" y2={y} stroke="#3a1a0e" strokeWidth="0.6" />
        ))}
        {/* right column — offset */}
        {[8, 24, 40, 56].map(y => (
          <line key={`r${y}`} x1="9" y1={y} x2="18" y2={y} stroke="#3a1a0e" strokeWidth="0.6" />
        ))}
        <rect x="0" y="0" width="2" height="60" fill="#a8584a" opacity="0.6" />
      </svg>
    );
  },
  prop_neon_sign: (size = 36) => (
    <svg width={size * 1.4} height={size * 0.55} viewBox="0 0 50 20">
      <defs>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Sign backplate */}
      <rect x="1" y="2" width="48" height="16" rx="3" fill="#1a1a22" stroke="#e84c8a" strokeWidth="0.7" filter="url(#neonGlow)" />
      {/* "CODE" tube text */}
      <text x="25" y="14" textAnchor="middle" fontFamily="Consolas, monospace" fontSize="9" fontWeight="700" fill="#ff67b0" filter="url(#neonGlow)" stroke="#fff5fb" strokeWidth="0.15">CODE</text>
      <style>{`@keyframes cgNeonPulse { 0%,100%{opacity:1} 50%{opacity:0.75} }`}</style>
      <rect x="1" y="2" width="48" height="16" rx="3" fill="none" stroke="#ff67b0" strokeWidth="0.4" opacity="0.4">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.2s" repeatCount="indefinite" />
      </rect>
    </svg>
  ),
};

// Items that should fire onToyInteract when clicked (without dragging).
const CLICKABLE_TOYS = new Set([
  'doll', 'plushie', 'squeaky_toy',
  'guitar', 'piano', 'drum_kit', 'microphone', 'turntable',
]);

function FurnitureSprite({ item, fedItemEmoji, overridePos, onMove, onToyInteract, onTrashItem, trashRectRef }) {
  // For multi-instance items, item.id is `<baseId>#<uid>` and item.baseId is
  // the catalog id. Use baseId for sprite/position lookups; item.id remains
  // the unique key for drag positions and trashing.
  const id = item.id || item;
  const baseId = item.baseId || id;
  const emoji = SPRITES[baseId];
  const defaultPos = FURNITURE_POS[baseId] || { left: '50%', bottom: 14, size: 22 };
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const dragRef = useRef(null); // { startX, startY, origLeftPct, origTopPct, parentRect, pointerId, moved }
  const clickable = onToyInteract && CLICKABLE_TOYS.has(baseId);
  // Housing-category items are immune to trash; decorations/toys/instruments are trashable.
  const trashable = !!onTrashItem && (item.category === 'decoration' || item.category === 'toy' || item.category === 'instrument');

  if (!emoji) return null;

  const usingOverride = overridePos && typeof overridePos.xPct === 'number';
  const xPct = usingOverride ? overridePos.xPct : null;
  const yPct = usingOverride ? overridePos.yPct : null;
  const isTray = id === 'food_tray';

  const baseStyle = {
    position: 'absolute',
    fontSize: defaultPos.size,
    filter: dragging ? 'drop-shadow(0 4px 6px #000c)' : 'drop-shadow(0 2px 0 #0008)',
    cursor: onMove ? (dragging ? 'grabbing' : 'grab') : 'default',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    transform: dragging ? 'translateX(-50%) scale(1.08)' : 'translateX(-50%)',
    transition: dragging ? 'none' : 'transform 0.15s ease',
    // Always above the pet sprite so the pet walking past doesn't steal the click.
    // Dragging bumps it even higher so it stays on top of anything else.
    zIndex: dragging ? 50 : 10,
    // Belt-and-suspenders: enable pointer events even if a parent set none.
    pointerEvents: 'auto',
    touchAction: 'none',
  };

  if (usingOverride) {
    baseStyle.left = `${xPct}%`;
    baseStyle.top  = `${yPct}%`;
  } else {
    if (defaultPos.left   != null) baseStyle.left   = defaultPos.left;
    if (defaultPos.top    != null) baseStyle.top    = defaultPos.top;
    if (defaultPos.bottom != null) baseStyle.bottom = defaultPos.bottom;
  }

  // Pointer Events API with pointer capture — once the down fires, every move
  // and up event is delivered to this exact element regardless of overlapping
  // layers, the pet walking over it, or layout reflow. Works the same in any
  // dock orientation and inside the pop-out window.
  function onPointerDown(e) {
    if (!onMove) return;
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    const parentRect = parent.getBoundingClientRect();
    const startLeftPct = usingOverride
      ? xPct
      : (parseFloat(String(defaultPos.left).replace('%', '')) || 50);
    const startTopPct = usingOverride
      ? yPct
      : (defaultPos.top != null
          ? parseFloat(String(defaultPos.top).replace('%', '')) || 30
          : (parentRect.height ? ((parentRect.height - (defaultPos.bottom ?? 14) - 12) / parentRect.height) * 100 : 70));
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origLeftPct: startLeftPct, origTopPct: startTopPct,
      parentRect,
      pointerId: e.pointerId,
      moved: false,
    };
    setDragging(true);
  }

  function isOverTrash(e) {
    const tr = trashRectRef?.current;
    if (!tr) return false;
    return e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dxPct = ((e.clientX - d.startX) / d.parentRect.width)  * 100;
    const dyPct = ((e.clientY - d.startY) / d.parentRect.height) * 100;
    if (Math.abs(dxPct) > 0.6 || Math.abs(dyPct) > 0.6) d.moved = true;
    const xPctNew = clampPct(d.origLeftPct + dxPct, 2, 98);
    const yPctNew = clampPct(d.origTopPct  + dyPct, 0, 92);
    onMove?.(id, { xPct: xPctNew, yPct: yPctNew });
    setOverTrash(isOverTrash(e));
  }

  function onPointerEnd(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
    // Tap (no real drag) on a clickable toy → fire toy interaction.
    if (clickable && !d.moved) {
      try { onToyInteract(baseId); } catch {}
    }
    // Drop on trash → discard (decorations/toys only; housing immune)
    if (d.moved && isOverTrash(e)) {
      if (trashable) {
        try { onTrashItem?.(id); } catch {}
      } else {
        // shake the panel via temporary state — handled by PetPanel via a CustomEvent
        try { window.dispatchEvent(new CustomEvent('cg-trash-rejected', { detail: { id: baseId } })); } catch {}
      }
    }
    setOverTrash(false);
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={ref}
      style={baseStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      title={onMove ? 'drag to reposition' : ''}
    >
      <div style={{ filter: overTrash ? (trashable ? 'hue-rotate(120deg) saturate(2)' : 'hue-rotate(0deg) sepia(1)') : 'none', transition: 'filter 0.1s ease' }}>
        {emoji === '__svg__' && SPRITE_SVG[baseId] ? SPRITE_SVG[baseId](defaultPos.size) : emoji}
      </div>
      {isTray && fedItemEmoji && (
        <span style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', fontSize: 14 }}>{fedItemEmoji}</span>
      )}
    </div>
  );
}

function clampPct(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Resolve a furniture item's current x-position (0..100 %), preferring a
 *  user-dragged override, falling back to the default in FURNITURE_POS. */
export function getFurnitureXPct(id, furniturePositions = {}) {
  const override = furniturePositions[id];
  if (override?.xPct != null) return override.xPct;
  const def = FURNITURE_POS[id];
  if (!def) return 50;
  if (typeof def.left === 'string' && def.left.endsWith('%')) {
    return parseFloat(def.left) || 50;
  }
  return 50;
}

/** Resolve a furniture item's current y-position (0..100 %). Items defaulting
 *  to `bottom: Npx` are treated as "near the floor" (~92). Used by the pet's
 *  2.5D walking AI so it actually moves up to wall-mounted things like the
 *  shower or a high-dragged bed instead of teleport-sleeping in midair. */
export function getFurnitureYPct(id, furniturePositions = {}) {
  const override = furniturePositions[id];
  if (override?.yPct != null) return override.yPct;
  const def = FURNITURE_POS[id];
  if (!def) return 92;
  if (typeof def.top === 'string' && def.top.endsWith('%')) {
    return parseFloat(def.top) || 50;
  }
  if (typeof def.top === 'number') return def.top;
  // bottom-anchored → floor
  return 92;
}

/** A single poop sprite. In pickupMode the user can drag it onto the trash. */
function DraggablePoop({ poop, pickupMode, trashRectRef, onPoopRemove }) {
  const ref = useRef(null);
  const dragRef = useRef(null);
  const [pos, setPos] = useState({ x: poop.xPct, y: null });    // y in px from bottom, null = floor (4)
  const [overTrash, setOverTrash] = useState(false);

  function isOverTrash(e) {
    const tr = trashRectRef?.current;
    if (!tr) return false;
    return e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
  }

  function onPointerDown(e) {
    if (!pickupMode || !onPoopRemove) return;
    e.preventDefault(); e.stopPropagation();
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    const parentRect = parent.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: poop.xPct,
      parentRect, pointerId: e.pointerId,
    };
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dxPct = ((e.clientX - d.startX) / d.parentRect.width)  * 100;
    const dyPx  = e.clientY - d.startY;
    setPos({ x: clampPct(d.origX + dxPct, 1, 99), y: -dyPx });   // negative because bottom origin
    setOverTrash(isOverTrash(e));
  }
  function onPointerEnd(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
    if (isOverTrash(e)) {
      try { onPoopRemove(poop.id); } catch {}
    } else {
      // Snap back if not dropped on trash
      setPos({ x: poop.xPct, y: null });
    }
    setOverTrash(false);
    dragRef.current = null;
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      style={{
        position: 'absolute',
        // Clamp to a safe margin so the emoji (rendered with translateX(-50%))
        // can't sit half-off the env edge under overflow:hidden.
        left: `${Math.max(4, Math.min(96, pos.x))}%`,
        bottom: pos.y != null ? `${4 + (pos.y || 0)}px` : 4,
        fontSize: 16,
        transform: `translateX(-50%) ${overTrash ? 'scale(1.2)' : 'scale(1)'}`,
        filter: overTrash ? 'hue-rotate(120deg) saturate(2) drop-shadow(0 1px 0 #0008)' : 'drop-shadow(0 1px 0 #0008)',
        cursor: pickupMode ? 'grab' : 'default',
        pointerEvents: pickupMode ? 'auto' : 'none',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: dragRef.current ? 60 : 5,
      }}
    >💩</div>
  );
}

function BouncingBall({ onKick = null }) {
  const [pos, setPos] = useState({ x: 50, y: 0 });
  const stateRef = useRef({ x: 50, y: 0, vx: 1.2, vy: 0, settled: false, settleAt: 0 });
  const rafRef = useRef(null);
  const tickerRef = useRef(null);

  // Click the ball to give it a kick (or whenever the user wants it moving).
  function kick(impulseX = (Math.random() - 0.5) * 4) {
    const s = stateRef.current;
    s.vx = impulseX || (Math.random() < 0.5 ? -1.5 : 1.5);
    s.vy = -3 - Math.random() * 2;
    s.settled = false;
    if (!rafRef.current) loop();
  }

  function loop() {
    rafRef.current = requestAnimationFrame(step);
  }

  function step() {
    const s = stateRef.current;
    s.vy += 0.15;          // gravity
    s.vx *= 0.992;         // air drag
    s.x  += s.vx;
    s.y  += s.vy;
    if (s.y > 30) { s.y = 30; s.vy = -Math.abs(s.vy) * 0.72; s.vx *= 0.88; }   // floor + rolling friction
    if (s.x > 95) { s.x = 95; s.vx = -Math.abs(s.vx) * 0.85; }
    if (s.x < 2)  { s.x = 2;  s.vx =  Math.abs(s.vx) * 0.85; }

    // Settle when essentially still on the floor.
    if (s.y >= 29.8 && Math.abs(s.vy) < 0.4 && Math.abs(s.vx) < 0.08) {
      s.vx = 0; s.vy = 0; s.y = 30;
      s.settled = true;
      s.settleAt = Date.now();
      setPos({ x: s.x, y: s.y });
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    setPos({ x: s.x, y: s.y });
    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    loop();
    // Every 30-60s, gently nudge the ball if it's been settled a while —
    // pretend the pet booped it. Keeps the room feeling alive without spinning.
    tickerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (s.settled && Date.now() - s.settleAt > 25_000 && Math.random() < 0.35) {
        kick();
      }
    }, 8000);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); kick(); if (onKick) try { onKick(); } catch {} }}
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        bottom: `${14 + pos.y}px`,
        fontSize: 14,
        cursor: 'pointer',
        pointerEvents: 'auto',
        transform: 'translateX(-50%)',
        userSelect: 'none',
      }}
      title="click to kick the ball"
    >⚽</div>
  );
}
