import { useEffect, useRef, useState } from 'react';
import { Environment } from './Environment.jsx';
import { PetCanvas } from './PetCanvas.jsx';
import { ChatBubble } from './ChatBubble.jsx';
import { StatBars } from './StatBars.jsx';
import { TokenDisplay } from './TokenDisplay.jsx';
import { Tombstones } from './Tombstones.jsx';
import { ActionBar } from './ActionBar.jsx';
// PetChat removed in Phase 10 — the "talk to pet" feature now lives behind
// the /pet <message> slash command in the main chat input. Saves the panel
// 30+ pixels of vertical real estate per dock orientation.
import { PERSONALITIES } from '../engine/Personalities.js';

/**
 * PetPanel — entire pet UI container. Used in bottom/top/right docked modes
 * and inside the floating pet window.
 */
export function PetPanel({
  petPos,
  petAppearance,
  petName,
  stage,
  stageName,
  stats,
  tokens,
  intelligence,
  mood,
  speech,
  evolutionScore,
  inventory = [],
  housing = 'default',
  foreground = null,
  onToyInteract,
  clothing = [],
  bugs = 0,
  tombstones = [],
  namingMode,
  onConfirmName,
  // actions
  onFeed, onPlay, onClean, onShop, onGames,
  // dock controls
  onPosChange, onPopOut, onDockIn,
  isFloating,
  onOpenProfile,
  interactionTarget,
  fedItemEmoji,
  showerActive,
  // Pet chat (intelligence already in props list above)
  bio,
  onPetSays,
  onBubbleDismiss,
  onPetClick,
  onFurnitureMove,
  furniturePositions = {},
  onClearRoom,
  poops = [],
  onArrive,
  onNap,
  onWake,
  isNapping = false,
  wellRestedUntil = 0,
  onTrashItem,
  pickupMode = false,
  onTogglePickup,
  onPoopRemove,
  onMinimizedChange,
}) {
  // envSize now lives below alongside the ResizeObserver hook so it's
  // always the measured host size, not a stale hardcoded default.
  const personalityKey = petAppearance?.adult?.personalityKey;
  // Trash drop zone — its DOMRect is registered in this ref every render so
  // dragged sprites (FurnitureSprite, DraggablePoop) can hit-test against it.
  const trashEl = useRef(null);
  const trashRectRef = useRef(null);
  const [trashShake, setTrashShake] = useState(false);
  useEffect(() => {
    function updateRect() {
      trashRectRef.current = trashEl.current?.getBoundingClientRect() || null;
    }
    updateRect();
    window.addEventListener('resize', updateRect);
    const interval = setInterval(updateRect, 500);   // catch scroll/layout shifts
    function onRejected() { setTrashShake(true); setTimeout(() => setTrashShake(false), 400); }
    window.addEventListener('cg-trash-rejected', onRejected);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('cg-trash-rejected', onRejected);
      clearInterval(interval);
    };
  });

  // Auto-pick a quip if no explicit speech and a stat is critical
  const autoQuip = pickAutoQuip(stats, personalityKey, mood, stage);
  const bubbleText = speech || autoQuip;

  // Resize observer
  useEffect(() => {
    const el = document.getElementById('cg-env');
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setEnvSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isHorizontal = petPos === 'bottom' || petPos === 'top';

  // Minimize: collapses everything below the tombstone row to a single
  // speech-line strip. Toggle persists for the session.
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { onMinimizedChange?.(minimized); }, [minimized, onMinimizedChange]);

  // Measure the envHost so Environment + PetCanvas get the EXACT pixel height
  // available to them — no more hardcoded 180/220 that clipped sprites when
  // the dock height changed. ResizeObserver re-measures on any layout shift.
  const envHostRef = useRef(null);
  const [envSize, setEnvSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = envHostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        setEnvSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ ...S.wrap, ...(isHorizontal ? S.wrapH : S.wrapV) }}>
      {/* Tombstones strip + minimize/expand toggle on the right */}
      <div style={S.tombRow}>
        <div style={{ flex: 1, minWidth: 0 }}><Tombstones tombstones={tombstones} /></div>
        <button
          style={S.minBtn}
          onClick={() => setMinimized(m => !m)}
          title={minimized ? 'Expand pet panel' : 'Minimize to speech line'}
        >{minimized ? '▢' : '—'}</button>
      </div>

      {/* When minimized, render only a single line for pet speech and skip
          everything else (header, env, stats, etc). Action bar + dock buttons
          hide too — user expands first to interact. */}
      {minimized ? (
        <div style={S.minLine}>
          <span style={S.minPet}>{petName ? `${petName}:` : (stage === 0 ? '🥚' : '🐾')}</span>
          <span style={S.minSpeech}>{bubbleText || (stage === 0 ? '(incubating)' : '…')}</span>
        </div>
      ) : (<></>)}
      {!minimized && (<>
      {/* (whole existing body below is wrapped in this conditional) */}

      {/* Single consolidated row: trash + actions + tokens/INT + dock controls.
          Name & age moved to the profile modal — saves a full row of UI.
          Tombstones strip above is the only thing left of the prior header. */}
      <div style={S.headerRow}>
        <div
          ref={trashEl}
          title="drop decorations/toys/poop here to delete (housing is safe)"
          style={{
            ...S.trash,
            animation: trashShake ? 'cgTrashShake 0.4s ease-in-out' : 'none',
          }}
        >🗑️</div>
        <ActionBar
          onFeed={onFeed} onClean={onClean}
          onNap={onNap} onWake={onWake} isNapping={isNapping}
          onShop={onShop} onGames={onGames}
          onTogglePickup={onTogglePickup} pickupMode={pickupMode}
          disabled={stage === 0 || stage === 4}
          stage={stage}
        />
        <div style={{ flex: 1 }} />
        <TokenDisplay tokens={tokens} intelligence={intelligence} />
        <div style={S.dockBtns}>
          {onOpenProfile && (
            <button title={petName ? `${petName} (profile)` : 'Pet profile'} style={S.dockBtn} onClick={onOpenProfile}>👤</button>
          )}
          {onClearRoom && (
            <button
              title="Clear room (un-place all furniture; items stay in inventory)"
              style={S.dockBtn}
              onClick={() => {
                if (window.confirm('Clear all furniture from the room? Items stay in inventory and can be re-placed from the Shop.')) {
                  onClearRoom();
                }
              }}
            >🧹</button>
          )}
          {!isFloating && ['top', 'bottom', 'right'].map(p => (
            <button
              key={p}
              title={p === 'right' ? 'side' : p}
              style={{ ...S.dockBtn, ...(petPos === p ? S.dockBtnActive : {}), fontWeight: 700 }}
              onClick={() => onPosChange(p)}
            >{p === 'top' ? 'T' : p === 'bottom' ? 'B' : 'S'}</button>
          ))}
          {!isFloating && <button title="Pop out" style={S.dockBtn} onClick={onPopOut}>↗</button>}
          {isFloating && <button title="Dock back" style={S.dockBtn} onClick={onDockIn}>↙</button>}
        </div>
      </div>

      {/* Main row: environment + stats. When the pet is napping OR the mood
          says it's sleeping, dim the whole env ~30% to simulate lights out. */}
      <div style={isHorizontal ? S.mainRowH : S.mainRowV}>
        <div
          id="cg-env"
          ref={envHostRef}
          style={{
            ...S.envHost,
            filter: (isNapping || mood === 'sleeping') ? 'brightness(0.7)' : 'none',
            transition: 'filter 0.6s ease',
          }}
        >
          <Environment
            housing={housing}
            foreground={foreground}
            furniture={inventory.filter(it =>
              (it.placed !== false) &&
              // Multi-instance decorations have a synthetic id like `prop_x#uid`
              // but carry the original catalog id on baseId — use that for the
              // furniture-id whitelist check.
              (it.slot === 'housing-furniture' || isFurnitureId(it.baseId || it.id))
            )}
            bugs={bugs}
            height={envSize.h || (isHorizontal ? 180 : 220)}
            fedItemEmoji={fedItemEmoji}
            showerActive={showerActive}
            hasBall={inventory.some(it => it.id === 'rubber_ball' && it.placed !== false)}
            furniturePositions={furniturePositions}
            onFurnitureMove={onFurnitureMove}
            onToyInteract={onToyInteract}
            onTrashItem={onTrashItem}
            trashRectRef={trashRectRef}
            pickupMode={pickupMode}
            onPoopRemove={onPoopRemove}
            poops={poops}
          >
            {/* Pet sits inside environment.
                pointerEvents:none lets clicks fall through to draggable furniture
                below; the pet sprite's own click target re-enables pointer events
                on just its hit-box inside PetCanvas. */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <PetCanvas
                appearance={petAppearance}
                stage={stage}
                mood={mood}
                evolutionScore={evolutionScore}
                clothing={clothing}
                inventory={inventory}
                interactionTarget={interactionTarget}
                onArrive={onArrive}
                width={envSize.w}
                height={envSize.h || (isHorizontal ? 180 : 220)}
                speech={bubbleText}
                onBubbleDismiss={onBubbleDismiss}
                onPetClick={onPetClick}
                wellRestedUntil={wellRestedUntil}
                obstacles={buildObstacleRects(inventory, furniturePositions, envSize.w, isHorizontal ? 180 : 220)}
              />
            </div>
          </Environment>
        </div>

        <div style={isHorizontal ? S.statsHost : S.statsHostV}>
          <StatBars stats={stats} />
        </div>
      </div>

      {namingMode && (
        <NamingOverlay
          personalityKey={personalityKey}
          onConfirm={onConfirmName}
          petAppearance={petAppearance}
          stage={stage}
          clothing={clothing}
          evolutionScore={evolutionScore}
        />
      )}
      </>)}
    </div>
  );
}

function pickAutoQuip(stats, personalityKey, mood, stage) {
  if (!stats || stage < 1) return null;
  const p = PERSONALITIES[personalityKey];
  if (!p) return null;
  if (stats.health <= 15 && p.deathWarningQuip) return p.deathWarningQuip;
  if (stats.hunger <= 15 && p.hungryQuip) return p.hungryQuip;
  if (stats.cleanliness <= 20 && p.dirtyQuip) return p.dirtyQuip;
  if (stats.boredom >= 80 && p.boredQuip) return p.boredQuip;
  if (stats.sleepiness >= 80 && p.sleepyQuip) return p.sleepyQuip;
  return null;
}

/**
 * Build a list of axis-aligned bounding boxes for items the pet should
 * physically avoid (walls). Coords are env-relative pixels matching the
 * Y-from-top space the walker uses. PetCanvas does the actual hit-testing.
 */
function buildObstacleRects(inventory, furniturePositions = {}, envW = 380, envH = 180) {
  const out = [];
  for (const it of inventory) {
    if (it.placed === false) continue;
    const base = it.baseId || it.id;
    if (base !== 'wall_horizontal' && base !== 'wall_vertical') continue;
    // Default positions from Environment FURNITURE_POS — duplicate here so we
    // don't have to thread that map through; falls back to a center floor pos.
    const pos = furniturePositions[it.id] || (base === 'wall_horizontal'
      ? { xPct: 50, yPct: null }
      : { xPct: 50, yPct: 40 });
    const xPct = pos.xPct ?? 50;
    const isH = base === 'wall_horizontal';
    // Sprite footprints in px (mirrors the SVG renders in Environment.jsx).
    const w = isH ? 80 : Math.round(48 * 0.35);
    const h = isH ? Math.round(80 * 0.15) : 48;
    // x is centered on xPct (translateX -50% in FurnitureSprite).
    const cx = (xPct / 100) * envW;
    const left = cx - w / 2;
    // y: vertical walls use yPct (top-relative), horizontal walls default to
    // sitting near the floor (bottom: 14px). Convert to top-relative px.
    let top;
    if (pos.yPct != null) top = (pos.yPct / 100) * envH;
    // Floor anchor: bottom: 14 default places the sprite that far above env bottom.
    else top = envH - 14 - h;
    out.push({ x: left, y: top, w, h });
  }
  return out;
}

function isFurnitureId(id) {
  return [
    'fancy_bed', 'aquarium', 'second_monitor', 'bookshelf', 'whiteboard',
    'pet_bed', 'shower_head', 'pet_pc', 'food_tray', 'tv', 'plant', 'table',
    'microphone', 'guitar', 'piano', 'drum_kit', 'turntable',
    'plushie', 'doll', 'squeaky_toy',
    'prop_window', 'prop_picture', 'prop_clock', 'prop_shelf', 'prop_neon_sign',
    'wall_horizontal', 'wall_vertical',
  ].includes(id);
}

function NamingOverlay({ personalityKey, onConfirm, petAppearance, stage, clothing = [], evolutionScore = 0 }) {
  const [name, setName] = useState('');
  const p = PERSONALITIES[personalityKey] || {};
  return (
    <div style={S.namingOverlay}>
      <div style={S.namingBox}>
        {petAppearance && (
          <div style={{ position: 'relative', height: 130, background: '#0a0a0f', borderRadius: 8, overflow: 'hidden', border: '1px solid #1a1a22' }}>
            <PetCanvas
              appearance={petAppearance}
              stage={stage ?? 2}
              mood="happy"
              evolutionScore={evolutionScore}
              clothing={clothing}
              width={260}
              height={130}
            />
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa' }}>
          {p.emoji || '✨'} <strong style={{ color: '#ddd' }}>{p.label || 'Mysterious'}</strong>
        </div>
        <div style={{ ...S.namingPrompt, fontFamily: p.font || 'inherit', color: p.colors?.text || '#eee' }}>
          {p.namingPrompt || 'Give me a name!'}
        </div>
        <input
          autoFocus
          style={S.namingInput}
          placeholder="enter a name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          maxLength={20}
        />
        <button
          style={{ ...S.namingBtn, opacity: name.trim() ? 1 : 0.4 }}
          disabled={!name.trim()}
          onClick={() => onConfirm(name.trim())}
        >Name me {p.emoji || '✨'}</button>
      </div>
    </div>
  );
}

const S = {
  wrap:       { display: 'flex', flexDirection: 'column', background: '#0a0a0f', height: '100%', overflow: 'hidden', position: 'relative', userSelect: 'none' },
  wrapH:      {},
  wrapV:      {},
  // No wrap — wrapping pushed buttons to a 2nd row, halved the env height,
  // and the pet sprite bled into the sibling sidebar below. overflowX:auto
  // lets the user scroll the action bar horizontally on narrow windows.
  headerRow:  { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderBottom: '1px solid #15151b', flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto', minWidth: 0 },
  tombRow:    { display: 'flex', alignItems: 'stretch', gap: 6, padding: '0 8px', flexShrink: 0 },
  minBtn:     { width: 24, padding: 0, background: '#15151b', border: '1px solid #222', color: '#aaa', borderRadius: 4, cursor: 'pointer', fontSize: 11, marginTop: 2, marginBottom: 2 },
  minLine:    { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderTop: '1px solid #15151b', color: '#ccc', fontSize: 12, overflow: 'hidden' },
  minPet:     { color: '#888', fontWeight: 700, flexShrink: 0 },
  minSpeech:  { fontStyle: 'italic', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  trash:      { fontSize: 18, lineHeight: 1, padding: '4px 6px', background: '#1a1a22', border: '1px dashed #444', borderRadius: 6, userSelect: 'none', cursor: 'default', flexShrink: 0 },
  nameBlock:  { display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  petLabel:   { fontSize: 12, fontWeight: 600, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stageTag:   { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  dockBtns:   { display: 'flex', gap: 3 },
  dockBtn:    { width: 22, height: 20, background: '#15151b', border: '1px solid #222', color: '#888', cursor: 'pointer', borderRadius: 4, fontSize: 11, padding: 0 },
  dockBtnActive: { background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  mainRowH:   { display: 'flex', flex: 1, gap: 6, padding: '4px 6px', minHeight: 0 },
  // Vertical (side-dock + pop-out): drop horizontal padding so the env reaches
  // the panel edges. With 6px each side the env was visibly inset; for tall
  // narrow layouts every pixel of width matters.
  mainRowV:   { display: 'flex', flexDirection: 'column', flex: 1, gap: 6, padding: '4px 0', minHeight: 0 },
  // overflow:hidden so Environment can't bleed past its host into the sibling
  // sessions sidebar / chat area when the action bar wraps onto a second row
  // and the measured height transiently lags. minHeight:0 lets flex shrink.
  envHost:    { flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' },
  // Horizontal: sidebar shape (130px wide). Vertical: full-width band below
  // the env. The horizontal style is the default; pet panel JSX picks the
  // right variant via isHorizontal.
  statsHost:  { width: 130, flexShrink: 0, background: '#080810', borderRadius: 6, border: '1px solid #1a1a22' },
  statsHostV: { width: '100%', maxWidth: '100%', flexShrink: 0, background: '#080810', borderRadius: 6, border: '1px solid #1a1a22', boxSizing: 'border-box' },
  namingOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  namingBox:  { background: '#111', border: '1px solid #333', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', minWidth: 280 },
  namingPrompt: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
  namingInput: { background: '#0a0a0f', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', textAlign: 'center', fontFamily: 'inherit' },
  namingBtn:  { padding: '10px 16px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};

// Global keyframes for the trash-reject shake (used via cgTrashShake animation name).
if (typeof document !== 'undefined' && !document.getElementById('cgTrashKeyframes')) {
  const style = document.createElement('style');
  style.id = 'cgTrashKeyframes';
  style.innerHTML = `
    @keyframes cgTrashShake {
      0%,100% { transform: translateX(0); }
      25%     { transform: translateX(-4px); }
      75%     { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}
