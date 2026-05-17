import { useEffect, useState } from 'react';
import { Environment } from './Environment.jsx';
import { PetCanvas } from './PetCanvas.jsx';
import { ChatBubble } from './ChatBubble.jsx';
import { StatBars } from './StatBars.jsx';
import { TokenDisplay } from './TokenDisplay.jsx';
import { Tombstones } from './Tombstones.jsx';
import { ActionBar } from './ActionBar.jsx';
import { PetChat }   from './PetChat.jsx';
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
}) {
  const [envSize, setEnvSize] = useState({ w: 380, h: 140 });
  const personalityKey = petAppearance?.adult?.personalityKey;

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

  return (
    <div style={{ ...S.wrap, ...(isHorizontal ? S.wrapH : S.wrapV) }}>
      {/* Tombstones strip */}
      <Tombstones tombstones={tombstones} />

      {/* Top row: name + stats + tokens + dock controls */}
      <div style={S.headerRow}>
        <div style={S.nameBlock}>
          <span style={S.petLabel}>
            {stage === 0 ? '🥚 Egg'
              : petName
                ? petName
                : (stageName || 'Pet')}
          </span>
          <span style={S.stageTag}>{stageName}</span>
        </div>
        <TokenDisplay tokens={tokens} intelligence={intelligence} />
        <div style={S.dockBtns}>
          {onOpenProfile && (
            <button title="Pet profile" style={S.dockBtn} onClick={onOpenProfile}>👤</button>
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
          {!isFloating && ['bottom', 'top', 'right'].map(p => (
            <button key={p} title={p} style={{ ...S.dockBtn, ...(petPos === p ? S.dockBtnActive : {}) }} onClick={() => onPosChange(p)}>
              {p === 'bottom' ? '▭' : p === 'top' ? '▔' : '▮'}
            </button>
          ))}
          {!isFloating && <button title="Pop out" style={S.dockBtn} onClick={onPopOut}>↗</button>}
          {isFloating && <button title="Dock back" style={S.dockBtn} onClick={onDockIn}>↙</button>}
        </div>
      </div>

      {/* Action toolbar — at top so it never gets cropped off the bottom */}
      <ActionBar
        onFeed={onFeed} onClean={onClean}
        onNap={onNap} onWake={onWake} isNapping={isNapping}
        onShop={onShop} onGames={onGames}
        disabled={stage === 0 || stage === 4}
        stage={stage}
      />

      {/* Main row: environment + stats */}
      <div style={isHorizontal ? S.mainRowH : S.mainRowV}>
        <div id="cg-env" style={S.envHost}>
          <Environment
            housing={housing}
            foreground={foreground}
            furniture={inventory.filter(it =>
              (it.placed !== false) &&
              (it.slot === 'housing-furniture' || isFurnitureId(it.id))
            )}
            bugs={bugs}
            height={isHorizontal ? 180 : 220}
            fedItemEmoji={fedItemEmoji}
            showerActive={showerActive}
            hasBall={inventory.some(it => it.id === 'rubber_ball' && it.placed !== false)}
            furniturePositions={furniturePositions}
            onFurnitureMove={onFurnitureMove}
            onToyInteract={onToyInteract}
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
                height={isHorizontal ? 180 : 220}
                speech={bubbleText}
                onBubbleDismiss={onBubbleDismiss}
                onPetClick={onPetClick}
                wellRestedUntil={wellRestedUntil}
              />
            </div>
          </Environment>
        </div>

        <div style={S.statsHost}>
          <StatBars stats={stats} />
        </div>
      </div>

      <PetChat
        petAppearance={petAppearance}
        petName={petName}
        stage={stage}
        personalityKey={personalityKey}
        bio={bio}
        stats={stats}
        intelligence={intelligence}
        tokens={tokens}
        onPetSays={onPetSays}
      />

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

function isFurnitureId(id) {
  return [
    'fancy_bed', 'aquarium', 'second_monitor', 'bookshelf', 'whiteboard',
    'pet_bed', 'shower_head', 'pet_pc', 'food_tray', 'tv', 'plant',
    'microphone', 'guitar', 'piano', 'drum_kit', 'turntable',
    'plushie', 'doll', 'squeaky_toy',
    'prop_window', 'prop_picture', 'prop_clock', 'prop_shelf', 'prop_neon_sign',
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
  wrap:       { display: 'flex', flexDirection: 'column', background: '#0a0a0f', height: '100%', overflow: 'hidden', position: 'relative' },
  wrapH:      {},
  wrapV:      {},
  headerRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderBottom: '1px solid #15151b', flexShrink: 0 },
  nameBlock:  { display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  petLabel:   { fontSize: 12, fontWeight: 600, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stageTag:   { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  dockBtns:   { display: 'flex', gap: 3 },
  dockBtn:    { width: 22, height: 20, background: '#15151b', border: '1px solid #222', color: '#888', cursor: 'pointer', borderRadius: 4, fontSize: 11, padding: 0 },
  dockBtnActive: { background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  mainRowH:   { display: 'flex', flex: 1, gap: 6, padding: '4px 6px', minHeight: 0 },
  mainRowV:   { display: 'flex', flexDirection: 'column', flex: 1, gap: 6, padding: '4px 6px', minHeight: 0 },
  envHost:    { flex: 1, minWidth: 0, position: 'relative' },
  statsHost:  { width: 130, flexShrink: 0, background: '#080810', borderRadius: 6, border: '1px solid #1a1a22' },
  namingOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  namingBox:  { background: '#111', border: '1px solid #333', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', minWidth: 280 },
  namingPrompt: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
  namingInput: { background: '#0a0a0f', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', textAlign: 'center', fontFamily: 'inherit' },
  namingBtn:  { padding: '10px 16px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
