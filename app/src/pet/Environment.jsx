/**
 * Environment.jsx
 * Side-view 2D room. Renders wallpaper, floor, furniture (from inventory),
 * code bugs (errors), bouncing toys, and a slot for PetCanvas to render the pet on top.
 */

import { useEffect, useRef, useState } from 'react';

const WALLPAPERS = {
  default:              { wall: 'linear-gradient(180deg, #1a1a2a 0%, #14141d 100%)', floor: '#0a0a0f' },
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
  border_grass:   { color: '#2ecc71', kind: 'tufts' },
  border_sand:    { color: '#f4d28a', kind: 'sand' },
  border_flowers: { color: '#e74c3c', kind: 'flowers' },
  border_beach:   { color: '#f4d28a', kind: 'beach' },
};

// Per-id default positioning. Users can drag to reposition; persisted via
// furniturePositions in save. left/top are % strings, bottom is px from floor.
const FURNITURE_POS = {
  fancy_bed:       { left: '82%', bottom: 14, size: 40 },
  pet_bed:         { left: '82%', bottom: 14, size: 40 },
  shower_head:     { left: '92%', top: 6,     size: 32 },
  pet_pc:          { left: '60%', top: '38%', size: 30 },
  food_tray:       { left: '52%', bottom: 14, size: 34 },
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
};

const SPRITES = {
  fancy_bed:       '🛏️',
  pet_bed:         '🛏️',
  aquarium:        '🐠',
  second_monitor:  '🖥️',
  bookshelf:       '📚',
  whiteboard:      '🪧',
  food_tray:       '🍽',
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
  prop_neon_sign:  '💡',
};

export function Environment({
  housing, furniture = [], bugs = 0, children, height = 140,
  fedItemEmoji = null, showerActive = false,
  hasBall = false,
  furniturePositions = {}, onFurnitureMove,
  poops = [],
  foreground = null,
  onToyInteract = null,
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

      {/* Floor */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: 14, background: w.floor, borderTop: '1px solid #2a2a3a',
      }} />

      {/* Foreground border (grass tufts, sand, flowers, beach) — above floor, below pet */}
      {fg && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, pointerEvents: 'none', zIndex: 2 }}>
          {fg.kind === 'tufts' && Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(i * 7.2) % 100}%`,
              bottom: 8,
              width: 0, height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `10px solid ${fg.color}`,
              transform: `rotate(${(i % 2 ? -1 : 1) * 5}deg)`,
            }} />
          ))}
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
          {fg.kind === 'beach' && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: fg.color, opacity: 0.9 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: -4, height: 6, background: 'linear-gradient(180deg, #66c2c5, transparent)' }} />
              <span style={{ position: 'absolute', left: '4%', bottom: 8, fontSize: 20 }}>🌴</span>
              <span style={{ position: 'absolute', right: '4%', bottom: 8, fontSize: 20 }}>🌴</span>
              <span style={{ position: 'absolute', left: '46%', bottom: 4, fontSize: 12 }}>🐚</span>
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

      {/* 💩 Poops on the floor — sit until Clean is run */}
      {poops.map((p) => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.xPct}%`,
          bottom: 4,
          fontSize: 16,
          transform: 'translateX(-50%)',
          filter: 'drop-shadow(0 1px 0 #0008)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>💩</div>
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

// Items that should fire onToyInteract when clicked (without dragging).
const CLICKABLE_TOYS = new Set([
  'doll', 'plushie', 'squeaky_toy',
  'guitar', 'piano', 'drum_kit', 'microphone', 'turntable',
]);

function FurnitureSprite({ item, fedItemEmoji, overridePos, onMove, onToyInteract }) {
  const id = item.id || item;
  const emoji = SPRITES[id];
  const defaultPos = FURNITURE_POS[id] || { left: '50%', bottom: 14, size: 22 };
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null); // { startX, startY, origLeftPct, origTopPct, parentRect, pointerId, moved }
  const clickable = onToyInteract && CLICKABLE_TOYS.has(id);

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

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dxPct = ((e.clientX - d.startX) / d.parentRect.width)  * 100;
    const dyPct = ((e.clientY - d.startY) / d.parentRect.height) * 100;
    if (Math.abs(dxPct) > 0.6 || Math.abs(dyPct) > 0.6) d.moved = true;
    const xPctNew = clampPct(d.origLeftPct + dxPct, 2, 98);
    const yPctNew = clampPct(d.origTopPct  + dyPct, 0, 92);
    onMove?.(id, { xPct: xPctNew, yPct: yPctNew });
  }

  function onPointerEnd(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
    // Tap (no real drag) on a clickable toy → fire toy interaction.
    if (clickable && !d.moved) {
      try { onToyInteract(id); } catch {}
    }
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
      {emoji}
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
