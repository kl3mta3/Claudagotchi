import { useEffect, useState } from 'react';
import { ArtifactPanel } from './ArtifactPanel.jsx';

/**
 * Renderer that runs in the detached artifact BrowserWindow. Subscribes to
 * artifact state pushed from main and forwards user actions back through IPC.
 * Same pattern as FloatPetView.
 */
export function FloatArtifactView() {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!window.claudigotchi) return;
    const unsub = window.claudigotchi.onArtifactState?.(setState);
    window.claudigotchi.requestArtifactState?.();
    return unsub;
  }, []);

  const act = (action, payload) => window.claudigotchi?.sendArtifactAction?.({ action, payload });

  if (!state) {
    return <div style={S.loading}>connecting to artifacts…</div>;
  }

  return (
    <div style={S.root}>
      {/* Drag-handle title bar matching the pet pop-out chrome. */}
      <div style={S.titleBar}>
        <span>CLAUDAGOTCHI · ARTIFACTS</span>
        <button
          style={S.dockBtn}
          onClick={() => window.claudigotchi?.artifactDockIn?.()}
          title="Dock back into main window"
        >↙</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ArtifactPanel
          artifact={state.artifact}
          history={state.history || []}
          planPendingApproval={!!state.planPendingApproval}
          onClose={() => act('close')}
          onApprovePlan={() => act('approvePlan')}
          onRejectPlan={(reason) => act('rejectPlan', { reason })}
          onPickHistory={(a) => act('pickHistory', { artifact: a })}
          onCloseFile={(a) => act('closeFile', { artifact: a })}
        />
      </div>
    </div>
  );
}

const S = {
  root:    { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0f' },
  titleBar:{ height: 26, WebkitAppRegion: 'drag', background: '#0e0e14', borderBottom: '1px solid #1f1f28', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', fontSize: 10, color: '#666', letterSpacing: 2, flexShrink: 0 },
  dockBtn: { WebkitAppRegion: 'no-drag', width: 22, height: 20, background: '#15151b', border: '1px solid #222', color: '#888', borderRadius: 4, cursor: 'pointer', fontSize: 11 },
  loading: { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 12, letterSpacing: 2 },
};
