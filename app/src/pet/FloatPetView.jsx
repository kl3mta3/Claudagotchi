import { useEffect, useState } from 'react';
import { PetPanel } from './PetPanel.jsx';

/**
 * FloatPetView
 * The renderer that runs in the detached pet BrowserWindow. It owns no engines.
 * It subscribes to live pet-state pushed from the main window and forwards
 * user actions back through IPC. Shop / games modals open in the main window.
 */
// Lazy-import Shop only when we open it, keeping the pop-out bundle slim.
import { Shop } from '../shop/Shop.jsx';
import { PermissionPrompt } from '../claude-ui/PermissionPrompt.jsx';

export function FloatPetView() {
  const [state, setState] = useState(null);
  const [pickupMode, setPickupMode] = useState(false);
  const [showShop,   setShowShop]   = useState(false);
  // Permission prompts can fire while the user is focused on the pop-out;
  // mount the same queue here so they can Allow/Deny without alt-tabbing.
  const [permQueue, setPermQueue] = useState([]);
  useEffect(() => {
    if (!window.claudigotchi?.onToolPermissionRequest) return;
    return window.claudigotchi.onToolPermissionRequest((req) => setPermQueue(q => [...q, req]));
  }, []);
  function decidePerm(decision) {
    setPermQueue(q => {
      if (q.length === 0) return q;
      const [head, ...rest] = q;
      window.claudigotchi?.toolPermissionDecision?.(head.reqId, decision);
      return rest;
    });
  }

  useEffect(() => {
    if (!window.claudigotchi) return;
    const unsub = window.claudigotchi.onPetState(setState);
    window.claudigotchi.requestPetState?.();
    return unsub;
  }, []);

  if (!state) {
    return <div style={S.loading}>connecting to pet…</div>;
  }

  const act = (action, payload) => window.claudigotchi?.sendPetAction({ action, payload });

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Permission prompts can hit either window; mount the queue here too. */}
      <PermissionPrompt request={permQueue[0]} onDecide={decidePerm} />
      {/* Drag handle — the entire top strip is draggable like Electron's title bar. */}
      <div style={{
        height: 22,
        WebkitAppRegion: 'drag',
        background: '#0e0e14',
        borderBottom: '1px solid #1f1f28',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 10,
        color: '#666',
        letterSpacing: 2,
        flexShrink: 0,
      }}>
        <span>CLAUDAGOTCHI · PET</span>
      </div>
      {/* Fixed-height pet panel anchored to top. Sized so the FULL panel
          (tomb row + action row + env 220 + stat bars) fits without clipping. */}
      <div style={{ height: 500, flexShrink: 0, background: '#0a0a0f', overflow: 'hidden' }}>
        <PetPanel
          petPos="float"
          isFloating
      petAppearance={state.petAppearance}
      petName={state.petName}
      stage={state.stage}
      stageName={state.stageName}
      stats={state.stats}
      tokens={state.tokens}
      intelligence={state.intelligence}
      mood={state.mood}
      speech={state.speech}
      evolutionScore={state.evolutionScore}
      inventory={state.inventory}
      housing={state.housing}
      foreground={state.foreground}
      clothing={state.clothing}
      bugs={state.bugs}
      tombstones={state.tombstones}
      namingMode={state.namingMode}
      wellRestedUntil={state.wellRestedUntil || 0}
      poops={state.poops || []}
      furniturePositions={state.furniturePositions || {}}
      onConfirmName={(name) => act('confirmName', { name })}
      onFeed={()  => act('feed')}
      onPlay={()  => act('play')}
      onClean={() => act('clean')}
      onNap={()   => act('nap')}
      onWake={()  => act('wake')}
      isNapping={!!state.isNapping}
      onShop={()  => setShowShop(true)}
      onGames={() => act('openGames')}
      onDockIn={() => { window.claudigotchi?.petDockIn(); }}
      // Interactions that need to mutate main-window state are forwarded via
      // the existing sendPetAction IPC. Main translates them back into the
      // local handlers it already owns.
      onFurnitureMove={(id, pos) => act('furnitureMove', { id, pos })}
      onTrashItem={(id) => act('trashItem', { id })}
      onPoopRemove={(id) => act('poopRemove', { id })}
      onToyInteract={(id) => act('toyInteract', { id })}
      onArrive={(type) => act('petArrive', { type })}
      pickupMode={pickupMode}
      onTogglePickup={() => setPickupMode(m => !m)}
        />
      </div>
      {/* Black filler — eats any extra window height below the fixed panel. */}
      <div style={{ flex: 1, background: '#000', minHeight: 0 }} />
      {/* Shop lives in this window when popped out — the user requested it
          NOT round-trip into the main app. All purchase actions still flow
          back to main since that owns the engine + inventory. */}
      <Shop
        open={showShop}
        onClose={() => setShowShop(false)}
        tokens={state.tokens}
        stage={state.stage}
        inventory={state.inventory}
        clothing={state.clothing}
        housing={state.housing}
        foreground={state.foreground}
        unlockedGames={state.unlockedGames}
        unlockedAchievements={state.unlockedAchievements}
        onBuy={(item) => act('buy', { itemId: item.id })}
        onEquip={(item) => act('equip', { itemId: item.id })}
        onUnequip={(item) => act('unequip', { itemId: item.id })}
        onApplyHousing={(item) => act('applyHousing', { itemId: item.id })}
        onResetHousing={(item) => act('resetHousing', item ? { itemId: item.id } : {})}
        onTogglePlaced={(item, placed) => act('togglePlaced', { itemId: item.id, placed })}
      />
    </div>
  );
}

const S = {
  loading: { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 12, letterSpacing: 2 },
};
