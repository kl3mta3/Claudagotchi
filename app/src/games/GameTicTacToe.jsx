import { useEffect, useState } from 'react';
import { PERSONALITIES } from '../engine/Personalities.js';

/**
 * Tic-Tac-Toe. User plays X, pet plays O.
 *
 * Pet AI is local minimax (the search tree is tiny — instant moves), and the
 * pet drops a personality-flavored speech-bubble line after each of its moves
 * so it still feels like you're playing the pet, not a silent engine. Snappy
 * end-to-end; no API roundtrip per move.
 */
const LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // cols
  [0,4,8],[2,4,6],           // diagonals
];

function winnerOf(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}
function isFull(b) { return b.every(v => v); }

/** Minimax with alpha-beta. Pet is 'O' (maximizer), user is 'X' (minimizer). */
function bestMove(board) {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'O';
      const score = minimax(board, 0, false, -Infinity, Infinity);
      board[i] = null;
      if (score > best) { best = score; move = i; }
    }
  }
  return move;
}
function minimax(b, depth, isMax, alpha, beta) {
  const w = winnerOf(b);
  if (w === 'O') return 10 - depth;
  if (w === 'X') return depth - 10;
  if (isFull(b)) return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!b[i]) {
        b[i] = 'O';
        best = Math.max(best, minimax(b, depth + 1, false, alpha, beta));
        b[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!b[i]) {
        b[i] = 'X';
        best = Math.min(best, minimax(b, depth + 1, true, alpha, beta));
        b[i] = null;
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

const QUIPS_ON_MOVE = {
  peppy:    ['easy! ✨', 'my turn!!', 'got it!'],
  grumpy:   ['*sigh*', 'fine.', 'whatever.'],
  lazy:     ['mmh… there.', 'zzz okay…', '…fine.'],
  emo:      ['it is done.', '…there.', '*placed*'],
  nerdy:    ['(optimal move)', 'minimax says so.', 'check.'],
  snarky:   ['bold of you.', 'really?', 'oh, sure.'],
  zen:      ['the move flows.', 'as it must.', 'placed.'],
  dramatic: ['BEHOLD!', '*flourish*', 'A MASTERSTROKE!'],
};
const QUIPS_WIN = {
  peppy: 'wheee I won!! 🎉', grumpy: '…obviously.', lazy: 'huh. won.',
  emo: 'victory tastes like nothing.', nerdy: 'as calculated.',
  snarky: 'predictable.', zen: 'the river flows downstream.', dramatic: 'GLORY IS MINE!',
};
const QUIPS_LOSS = {
  peppy: 'aww!! gg!! 😅', grumpy: '*grumbles*', lazy: 'eh. nap time.',
  emo: 'i deserved this.', nerdy: 'recalibrating.',
  snarky: 'lucky.', zen: 'wins, losses, all impermanent.', dramatic: 'A TRAGEDY!',
};
const QUIPS_DRAW = {
  peppy: 'draw!!', grumpy: 'meh.', lazy: 'tied. nap?',
  emo: 'fitting.', nerdy: 'cat\'s game. expected.',
  snarky: 'so… nothing happened.', zen: 'balance.', dramatic: 'A STANDOFF!',
};

export function GameTicTacToe({ open, onEnd, petName, personalityKey, onPetSays }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn]   = useState('X');     // user starts
  const [over, setOver]   = useState(null);    // 'win' | 'loss' | 'draw' | null
  const p = PERSONALITIES[personalityKey] || {};

  useEffect(() => {
    if (!open) return;
    setBoard(Array(9).fill(null)); setTurn('X'); setOver(null);
  }, [open]);

  // Pet's turn — short artificial delay so it doesn't feel instant.
  useEffect(() => {
    if (!open || over || turn !== 'O') return;
    const t = setTimeout(() => {
      const next = [...board];
      const m = bestMove(next);
      if (m >= 0) {
        next[m] = 'O';
        setBoard(next);
        const w = winnerOf(next);
        if (w || isFull(next)) finish(next, w);
        else setTurn('X');
        const quip = (QUIPS_ON_MOVE[personalityKey] || QUIPS_ON_MOVE.peppy);
        onPetSays?.(quip[Math.floor(Math.random() * quip.length)]);
      }
    }, 600 + Math.random() * 400);
    return () => clearTimeout(t);
  }, [turn, board, open, over]);

  function finish(b, w) {
    let result;
    if (w === 'X') { setOver('win');  result = QUIPS_LOSS[personalityKey] || QUIPS_LOSS.peppy; }
    else if (w === 'O') { setOver('loss'); result = QUIPS_WIN[personalityKey]  || QUIPS_WIN.peppy; }
    else { setOver('draw'); result = QUIPS_DRAW[personalityKey] || QUIPS_DRAW.peppy; }
    onPetSays?.(result);
  }
  function click(i) {
    if (over || turn !== 'X' || board[i]) return;
    const next = [...board]; next[i] = 'X'; setBoard(next);
    const w = winnerOf(next);
    if (w || isFull(next)) finish(next, w);
    else setTurn('O');
  }
  function reset() { setBoard(Array(9).fill(null)); setTurn('X'); setOver(null); }

  if (!open) return null;
  const status = over === 'win'  ? '🎉 You won!'
               : over === 'loss' ? '😼 Pet won — rematch?'
               : over === 'draw' ? '🤝 Cat\'s game'
               : turn === 'X'     ? 'Your move (X)'
                                  : `${petName || 'Pet'} is thinking…`;
  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>⭕ Tic-Tac-Toe vs {petName || 'pet'}</h2>
          <button style={S.close} onClick={() => onEnd?.({ won: over === 'win', over })}>✕</button>
        </div>
        <div style={S.status}>{status}</div>
        <div style={S.grid}>
          {board.map((cell, i) => (
            <button
              key={i}
              style={{ ...S.cell, color: cell === 'X' ? '#6c63ff' : '#e74c3c', cursor: cell || over || turn !== 'X' ? 'default' : 'pointer' }}
              onClick={() => click(i)}
              disabled={!!cell || !!over || turn !== 'X'}
            >{cell || ''}</button>
          ))}
        </div>
        {over && <button style={S.btn} onClick={reset}>Play again</button>}
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { background: '#111', border: '1px solid #222', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  status:  { fontSize: 12, color: '#ffd166', textAlign: 'center' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: 240, height: 240, margin: '0 auto' },
  cell:    { background: '#15151b', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 48, fontWeight: 700, fontFamily: 'Consolas, monospace', aspectRatio: '1 / 1', minHeight: 0 },
  btn:     { padding: '8px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'center' },
};
