/**
 * Small picker modal — opens when the user clicks the 🎮 Games button.
 * Lists the always-available games (20Q + Throw Ball) plus any unlocked
 * shop games (2048, Breakout, Chess).
 */
export function GamesMenu({ open, unlockedGames = [], onClose, onPick }) {
  if (!open) return null;
  const games = [
    { id: '20q',       label: '20 Questions', emoji: '🤔', desc: 'Ask yes/no — guess what your pet is thinking of.', always: true },
    { id: 'throwBall', label: 'Throw Ball',   emoji: '⚽', desc: 'Toss the ball. Pet chases. Boredom -25.',         always: true },
    { id: 'tictactoe', label: 'Tic-Tac-Toe',  emoji: '⭕', desc: 'Classic X\'s and O\'s vs your pet.',              always: true },
    { id: '2048',      label: '2048',         emoji: '🔢', desc: 'Slide & merge tiles to reach 2048.' },
    { id: 'breakout',  label: 'Breakout',     emoji: '🧱', desc: 'Bounce the ball to clear all bricks.' },
    { id: 'chess',     label: 'Chess',        emoji: '♟️', desc: 'Play a full chess game vs your pet (powered by Claude).' },
    { id: 'checkers',  label: 'Checkers',     emoji: '🔴', desc: 'Classic 8×8 checkers vs your pet. Kings, jumps, the works.' },
    { id: 'battleship',label: 'Battleship',   emoji: '🚢', desc: 'Place your fleet, hunt the pet\'s ships.' },
    { id: 'connect4',  label: 'Connect Four', emoji: '🟡', desc: 'Drop discs — first to 4 in a row wins.' },
  ];
  const visible = games.filter(g => g.always || unlockedGames.includes(g.id));

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>🎮 Games</h2>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={S.grid}>
          {visible.map(g => (
            <button key={g.id} style={S.card} onClick={() => { onClose?.(); onPick?.(g.id); }}>
              <div style={S.emoji}>{g.emoji}</div>
              <div style={S.label}>{g.label}</div>
              <div style={S.desc}>{g.desc}</div>
            </button>
          ))}
        </div>
        {unlockedGames.length === 0 && (
          <div style={S.note}>More games available in the Shop's Games tab.</div>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { width: 480, maxWidth: '92vw', background: '#111', border: '1px solid #222', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  header:  { display: 'flex', alignItems: 'center' },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  card:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 10, cursor: 'pointer', color: '#eee', fontFamily: 'inherit', textAlign: 'center' },
  emoji:   { fontSize: 28 },
  label:   { fontSize: 13, fontWeight: 700 },
  desc:    { fontSize: 11, color: '#888' },
  note:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
