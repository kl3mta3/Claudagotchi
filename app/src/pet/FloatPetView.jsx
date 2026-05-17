import { useEffect, useState } from 'react';
import { PetPanel } from './PetPanel.jsx';

/**
 * FloatPetView
 * The renderer that runs in the detached pet BrowserWindow. It owns no engines.
 * It subscribes to live pet-state pushed from the main window and forwards
 * user actions back through IPC. Shop / games modals open in the main window.
 */
export function FloatPetView() {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!window.claudigotchi) return;
    const unsub = window.claudigotchi.onPetState(setState);
    // Ask main to push current state on mount.
    window.claudigotchi.requestPetState?.();
    return unsub;
  }, []);

  if (!state) {
    return <div style={S.loading}>connecting to pet…</div>;
  }

  const act = (action, payload) => window.claudigotchi?.sendPetAction({ action, payload });

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        <span>CLAUDIGOTCHI · PET</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
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
      onShop={()  => act('openShop')}
      onGames={() => act('openGames')}
      onDockIn={() => { window.claudigotchi?.petDockIn(); }}
        />
      </div>
    </div>
  );
}

const S = {
  loading: { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 12, letterSpacing: 2 },
};
