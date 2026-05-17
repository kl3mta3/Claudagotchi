import { useEffect, useState } from 'react';

/**
 * Throw-the-ball mini game.
 * - Shows a brief animation overlay of a ball arcing across the screen.
 * - When complete, calls onEnd with { won: true } (always a win — pet always catches).
 * - Stat effects are applied by GameManager.startGame using game.statEffects.
 */
export function ThrowBall({ open, onEnd }) {
  const [phase, setPhase] = useState('throw'); // 'throw' | 'caught'

  useEffect(() => {
    if (!open) return;
    setPhase('throw');
    const t1 = setTimeout(() => setPhase('caught'), 1400);
    const t2 = setTimeout(() => onEnd?.({ won: true }), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [open]);

  if (!open) return null;

  return (
    <div style={S.overlay}>
      <div style={S.frame}>
        <div style={S.label}>{phase === 'throw' ? 'WHOOSH!' : 'CAUGHT IT! 🎉'}</div>
        <div style={S.field}>
          <div style={{ ...S.ball, animation: 'cgBallArc 1.4s ease-out forwards' }}>🎾</div>
        </div>
      </div>
      <style>{`
        @keyframes cgBallArc {
          0%   { left: 5%;  top: 50%; }
          50%  { left: 50%; top: 5%;  }
          100% { left: 95%; top: 50%; }
        }
      `}</style>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  frame:   { width: 440, height: 220, background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  label:   { textAlign: 'center', color: '#ffd166', fontSize: 14, fontWeight: 700, letterSpacing: 2 },
  field:   { position: 'relative', flex: 1, background: 'linear-gradient(180deg,#1a1a2a,#0a0a14)', borderRadius: 8, overflow: 'hidden' },
  ball:    { position: 'absolute', fontSize: 24, transform: 'translate(-50%,-50%)' },
};
