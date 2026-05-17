import { useEffect, useState, useCallback } from 'react';

/**
 * 2048 — standard 4×4 grid. Arrow keys / WASD slide & merge.
 * Pure local game, no deps. On win (reach 2048): +30 happiness, +10 tokens.
 * On lose (no moves): small consolation reward.
 */
const SIZE = 4;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}
function addRandom(b) {
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!b[r][c]) empty.push([r, c]);
  if (!empty.length) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
  return b;
}
function slide(row) {
  const filtered = row.filter(v => v);
  const out = [];
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) { out.push(filtered[i] * 2); i++; }
    else out.push(filtered[i]);
  }
  while (out.length < SIZE) out.push(0);
  return out;
}
// Transpose helper. NOTE: this is a true transpose (rows ↔ columns), NOT a
// 90° rotation. Applying transpose twice is identity, so each axis transform
// below is its own inverse — keeps the move pipeline symmetric.
function transpose(g) {
  return g[0].map((_, i) => g.map(row => row[i]));
}
function reverseRows(g) { return g.map(r => [...r].reverse()); }

function move(b, dir) {
  // Strategy: transform the board so the desired compaction direction becomes
  // LEFT, slide every row, then apply the inverse transform. `slide()` always
  // compacts toward index 0 (left).
  let work = b.map(r => [...r]);
  if (dir === 'right')      work = reverseRows(work);
  else if (dir === 'up')    work = transpose(work);
  else if (dir === 'down')  work = reverseRows(transpose(work));

  for (let r = 0; r < SIZE; r++) work[r] = slide(work[r]);

  // Inverse transforms (each is self-inverse)
  if (dir === 'right')      work = reverseRows(work);
  else if (dir === 'up')    work = transpose(work);
  else if (dir === 'down')  work = transpose(reverseRows(work));

  return work;
}
function eq(a, b) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (a[r][c] !== b[r][c]) return false;
  return true;
}
function isLost(b) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (!b[r][c]) return false;
    if (c + 1 < SIZE && b[r][c] === b[r][c + 1]) return false;
    if (r + 1 < SIZE && b[r][c] === b[r + 1][c]) return false;
  }
  return true;
}
function maxTile(b) {
  let m = 0;
  for (const row of b) for (const v of row) if (v > m) m = v;
  return m;
}

const TILE_COLORS = {
  0:'#1a1a22', 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179', 16:'#f59563',
  32:'#f67c5f', 64:'#f65e3b', 128:'#edcf72', 256:'#edcc61', 512:'#edc850',
  1024:'#edc53f', 2048:'#edc22e',
};

export function Game2048({ open, onEnd }) {
  const [board, setBoard] = useState(() => addRandom(addRandom(emptyBoard())));
  const [score, setScore] = useState(0);
  const [over, setOver]   = useState(null);   // 'won'|'lost'|null

  const tryMove = useCallback((dir) => {
    if (over) return;
    setBoard(prev => {
      const next = move(prev, dir);
      if (eq(prev, next)) return prev;
      addRandom(next);
      // Add merged-into score: max tile difference is rough but use sum
      const newScore = next.flat().reduce((s, v) => s + v, 0);
      setScore(newScore);
      const top = maxTile(next);
      if (top >= 2048) setOver('won');
      else if (isLost(next)) setOver('lost');
      return next;
    });
  }, [over]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      const m = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                  w:'up', s:'down', a:'left', d:'right' }[e.key];
      if (m) { e.preventDefault(); tryMove(m); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, tryMove]);

  if (!open) return null;
  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🔢 2048</h2>
          <div style={S.score}>Score: {score}</div>
          <button style={S.close} onClick={() => onEnd?.({ won: over === 'won', score, top: maxTile(board) })}>✕</button>
        </div>
        <div style={S.board}>
          {board.map((row, r) => row.map((v, c) => (
            <div key={`${r}-${c}`} style={{ ...S.tile, background: TILE_COLORS[v] || '#3a2a1a', color: v >= 8 ? '#fff' : '#776e65', fontSize: v >= 128 ? 18 : 22 }}>
              {v || ''}
            </div>
          )))}
        </div>
        {over === 'won' && <div style={S.win}>🎉 You hit 2048!</div>}
        {over === 'lost' && <div style={S.lose}>No moves left — final score {score}</div>}
        <div style={S.hint}>Arrow keys or WASD to slide.</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { width: 360, background: '#111', border: '1px solid #222', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  score:   { fontSize: 12, color: '#ffd166', fontFamily: 'Consolas, monospace' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  board:   { display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 6, padding: 6, background: '#0c0c12', borderRadius: 8 },
  tile:    { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontWeight: 700, fontFamily: 'Consolas, monospace' },
  win:     { padding: 10, background: '#1a3a2a', color: '#7fffd4', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  lose:    { padding: 10, background: '#3a1a1a', color: '#ff8d8d', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
