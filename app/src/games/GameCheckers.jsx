import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Checkers vs your pet. User = RED (bottom), pet = BLACK (top).
 * Standard American rules:
 *   - Pieces move 1 diagonal forward; kings move 1 diagonal in any direction
 *   - Captures jump over an adjacent enemy onto an empty square (forward only
 *     for men, any direction for kings); multi-jumps are mandatory chains
 *   - Reach the opposite back row → promoted to king
 *   - Game ends when a side has no pieces OR no legal moves
 *
 * Pet picks moves via claudeSend (mode: 'chat') with a compact board summary
 * + a list of legal moves; falls back to random legal move on parse failure.
 *
 * Persistence: parent owns `savedGame: { board, turn, lastMove, sessionId }`
 * and gets `onStateChange` calls. Mirrors GameChess.
 */

const SIZE = 8;
// Square encoding: row 0 = top (pet's back row), row 7 = bottom (user's back).
// Cell values: null = empty, 'r' = red man, 'R' = red king, 'b' = black man, 'B' = black king.

function makeStartBoard() {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < SIZE; c++)
      if ((r + c) % 2 === 1) b[r][c] = 'b';
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < SIZE; c++)
      if ((r + c) % 2 === 1) b[r][c] = 'r';
  return b;
}

function colorOf(p)   { return !p ? null : (p === 'r' || p === 'R') ? 'r' : 'b'; }
function isKing(p)    { return p === 'R' || p === 'B'; }
function dirsFor(p)   {
  if (!p) return [];
  if (isKing(p)) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return colorOf(p) === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
}

/** All legal moves for `color`. Returns array of moves:
 *  { from:[r,c], to:[r,c], captures:[[r,c],...], promoted:bool, chain?:nextMoves[] }
 *  If any capture exists, only captures are returned (mandatory). */
function legalMoves(board, color) {
  const captures = [];
  const quiets   = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (colorOf(p) !== color) continue;
      const caps = capturesFrom(board, r, c, p, []);
      if (caps.length) captures.push(...caps);
      else for (const [dr, dc] of dirsFor(p)) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (board[nr][nc]) continue;
        quiets.push({
          from: [r,c], to: [nr,nc], captures: [],
          promoted: shouldPromote(p, nr),
        });
      }
    }
  }
  return captures.length ? captures : quiets;
}

/** Recursively find capture chains from [r,c] with piece p, having already
 *  captured `chain` (list of jumped squares). Returns flat list of moves whose
 *  `captures` is the chain. */
function capturesFrom(board, r, c, p, chain) {
  const moves = [];
  for (const [dr, dc] of dirsFor(p)) {
    const mr = r + dr, mc = c + dc;
    const lr = r + 2*dr, lc = c + 2*dc;
    if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
    if (board[lr][lc]) continue;
    const mid = board[mr]?.[mc];
    if (!mid || colorOf(mid) === colorOf(p)) continue;
    // Don't re-capture the same piece in this chain.
    if (chain.some(([cr, cc]) => cr === mr && cc === mc)) continue;
    // Make a hypothetical board for chain exploration.
    const b2 = board.map(row => row.slice());
    b2[r][c]   = null;
    b2[mr][mc] = null;
    const nextP = shouldPromote(p, lr) ? p.toUpperCase() : p;
    b2[lr][lc] = nextP;
    const newChain = [...chain, [mr, mc]];
    const further = capturesFrom(b2, lr, lc, nextP, newChain);
    if (further.length) moves.push(...further);
    else moves.push({
      from: [chain.length ? chain[0][0] === r ? [r,c] : [r,c] : [r,c]][0] || [r,c],
      to:   [lr, lc],
      captures: newChain,
      promoted: nextP !== p,
    });
  }
  return moves;
}

function shouldPromote(p, toRow) {
  if (!p || isKing(p)) return false;
  return (colorOf(p) === 'r' && toRow === 0) || (colorOf(p) === 'b' && toRow === SIZE - 1);
}

/** Apply a move (with possibly multi-square captures chain) to a fresh board. */
function applyMove(board, mv) {
  const b = board.map(row => row.slice());
  const [fr, fc] = mv.from;
  const [tr, tc] = mv.to;
  let p = b[fr][fc];
  b[fr][fc] = null;
  for (const [cr, cc] of (mv.captures || [])) b[cr][cc] = null;
  if (shouldPromote(p, tr)) p = p.toUpperCase();
  b[tr][tc] = p;
  return b;
}

function boardWinner(board, turn) {
  // Side that can't move loses. Also a side with no pieces loses.
  const counts = { r: 0, b: 0 };
  for (const row of board) for (const p of row) if (p) counts[colorOf(p)]++;
  if (counts.r === 0) return 'b';
  if (counts.b === 0) return 'r';
  if (legalMoves(board, turn).length === 0) return turn === 'r' ? 'b' : 'r';
  return null;
}

/** Convert [r,c] → square label like "a1" (file a-h = col 0-7, rank 1-8 with
 *  rank 1 at the BOTTOM = row 7, matching standard checkers/chess notation). */
function sqLabel([r, c]) { return 'abcdefgh'[c] + (8 - r); }
function parseSq(s) {
  const f = 'abcdefgh'.indexOf((s[0] || '').toLowerCase());
  const r = 8 - parseInt(s.slice(1), 10);
  if (f < 0 || isNaN(r) || r < 0 || r >= SIZE) return null;
  return [r, f];
}
/** "c3-d4" or "c3xe5" or "c3xe5xg7" → move-spec used to match against legalMoves. */
function parseMoveStr(s) {
  const parts = (s || '').replace(/\s+/g, '').split(/[-x]/);
  if (parts.length < 2) return null;
  const squares = parts.map(parseSq);
  if (squares.some(q => !q)) return null;
  return squares; // [[r,c], ...]
}
function moveMatchesSquares(mv, squares) {
  if (!squares || squares.length < 2) return false;
  const startMatch = mv.from[0] === squares[0][0] && mv.from[1] === squares[0][1];
  const endMatch   = mv.to[0]   === squares[squares.length-1][0] && mv.to[1] === squares[squares.length-1][1];
  return startMatch && endMatch;
}
function moveLabel(mv) {
  const sep = mv.captures.length ? 'x' : '-';
  return sqLabel(mv.from) + sep + sqLabel(mv.to);
}

export function GameCheckers({ open, onEnd, petName, personalityKey, savedGame, onStateChange }) {
  const [board, setBoard]   = useState(makeStartBoard);
  const [turn, setTurn]     = useState('r');      // 'r' (you) | 'b' (pet)
  const [selected, setSel]  = useState(null);     // [r,c]
  const [legalForSel, setLegalForSel] = useState([]);
  const [busy, setBusy]     = useState(false);
  const [over, setOver]     = useState(null);     // 'win'|'loss'|null
  const [lastMove, setLastMove] = useState(null); // {from, to, captures}
  const [error, setError]   = useState(null);
  const accRef = useRef('');
  const reqIdRef = useRef(null);
  const sessionRef = useRef(null);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // Boot — restore saved or fresh.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.board) {
      setBoard(savedGame.board);
      setTurn(savedGame.turn ?? 'r');
      setLastMove(savedGame.lastMove ?? null);
      sessionRef.current = savedGame.sessionId ?? null;
    } else {
      setBoard(makeStartBoard());
      setTurn('r');
      setLastMove(null);
      sessionRef.current = null;
    }
    setSel(null); setLegalForSel([]); setOver(null); setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist after every visible change.
  useEffect(() => {
    if (!open) return;
    onStateChangeRef.current?.({
      board, turn, lastMove, sessionId: sessionRef.current,
    });
  }, [board, turn, lastMove, open]);

  // Check end state, kick off pet turn.
  useEffect(() => {
    if (!open || over) return;
    const winner = boardWinner(board, turn);
    if (winner) { setOver(winner === 'r' ? 'win' : 'loss'); return; }
    if (turn === 'b' && !busy) {
      setTimeout(askPet, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, open]);

  // Restore mid-pet-turn after a reload.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.board && savedGame.turn === 'b' && !boardWinner(savedGame.board, 'b')) {
      setTimeout(askPet, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stream listener for pet move
  useEffect(() => {
    if (!open || !window.claudigotchi) return;
    const unsub = window.claudigotchi.onStream(({ sessionId: sid, requestId, event }) => {
      if (reqIdRef.current && requestId !== reqIdRef.current) return;
      if (sessionRef.current && sid !== sessionRef.current) return;
      const ev = event?.type === 'stream_event' ? event.event : event;
      if (!ev) return;
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        accRef.current += ev.delta.text;
      }
      if (ev.type === 'message_stop' || event?.type === 'result') {
        applyPetMove(accRef.current);
        accRef.current = '';
      }
    });
    return unsub;
  }, [open]);

  function applyPetMove(raw) {
    // Hard guard: only act when it's actually Black's turn (avoids duplicate
    // close events playing as the user).
    if (turn !== 'b') return;
    setBusy(false);
    const legal = legalMoves(board, 'b');
    if (!legal.length) return;
    // Try each whitespace-separated token, scanning end → start so any preamble
    // ("Hmm I'll play c3-d4") is parsed correctly.
    const tokens = (raw || '').replace(/[^\w\-x]/g, ' ').trim().split(/\s+/).filter(Boolean);
    let picked = null;
    for (let i = tokens.length - 1; i >= 0 && !picked; i--) {
      const squares = parseMoveStr(tokens[i]);
      if (!squares) continue;
      picked = legal.find(m => moveMatchesSquares(m, squares));
    }
    if (!picked) {
      picked = legal[Math.floor(Math.random() * legal.length)];
      setError(`Pet's move was unclear ("${(raw || '').slice(0, 40)}…") — picked a random legal move.`);
    }
    const b2 = applyMove(board, picked);
    setBoard(b2);
    setLastMove(picked);
    setTurn('r');
  }

  async function askPet() {
    if (!window.claudigotchi) return;
    setBusy(true); setError(null); accRef.current = '';
    const reqId = `checkers-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    reqIdRef.current = reqId;
    const legal = legalMoves(board, 'b');
    const summary = boardSummary(board);
    const sys = [
      `You ARE ${petName || 'the pet'}. Personality: ${personalityKey || 'peppy'}.`,
      `You are playing checkers as BLACK. The user is RED.`,
      `Board (rank 8 top, files a-h):`,
      summary,
      ``,
      `Legal moves: ${legal.map(moveLabel).slice(0, 30).join(', ')}${legal.length > 30 ? '…' : ''}`,
      ``,
      `Reply with ONLY one move from the legal list (format: "c3-d4" or "c3xe5"). No commentary.`,
    ].join('\n');
    try {
      const res = await window.claudigotchi.claudeSend({
        message: sys,
        sessionId: sessionRef.current,
        cwd: null, mode: 'chat',
        requestId: reqId,
        enableThinking: false,
      });
      if (res?.sessionId) sessionRef.current = res.sessionId;
      if (res?.error) { setError(`Send failed: ${res.error}`); applyPetMove(''); }
    } catch (e) {
      setError(`Send failed: ${e.message || e}`);
      applyPetMove('');
    }
  }

  function boardSummary(b) {
    const lines = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const p = b[r][c];
        row.push(p || '.');
      }
      lines.push(`${8 - r}  ${row.join(' ')}`);
    }
    lines.push('   a b c d e f g h');
    return lines.join('\n');
  }

  function onSquareClick(r, c) {
    if (busy || over) return;
    if (turn !== 'r') return;
    const p = board[r][c];
    if (selected) {
      // Try every legal move starting at selected and ending at (r,c).
      const all = legalMoves(board, 'r');
      const match = all.find(m =>
        m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c
      );
      if (match) {
        const b2 = applyMove(board, match);
        setBoard(b2);
        setLastMove(match);
        setSel(null); setLegalForSel([]);
        setTurn('b');
        return;
      }
      // Reselect another own piece
      if (p && colorOf(p) === 'r') {
        setSel([r, c]);
        setLegalForSel(legalMoves(board, 'r').filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to));
      } else {
        setSel(null); setLegalForSel([]);
      }
    } else if (p && colorOf(p) === 'r') {
      setSel([r, c]);
      setLegalForSel(legalMoves(board, 'r').filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to));
    }
  }

  if (!open) return null;
  const status = over ? (over === 'win' ? '🏆 You won!' : '😵 Pet won — try again') :
                 busy  ? `${petName || 'Pet'} is thinking…` :
                 turn === 'r' ? `Your move (red)` : `${petName || 'Pet'}'s move`;

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🔴 Checkers vs {petName || 'pet'}</h2>
          {!over && (
            <button
              style={S.surrender}
              onClick={() => {
                if (!confirm('Surrender this game? It will be cleared from disk.')) return;
                onEnd?.({ won: false, over: 'loss', surrendered: true });
              }}
            >🏳️ Surrender</button>
          )}
          <button style={S.close} onClick={() => onEnd?.({ won: over === 'win', over })} title="Close (resume later)">✕</button>
        </div>
        <div style={S.status}>{status}</div>
        <div style={S.board}>
          {board.map((row, r) => row.map((p, c) => {
            const dark = (r + c) % 2 === 1;
            const sel = selected && selected[0] === r && selected[1] === c;
            const targ = legalForSel.some(([tr, tc]) => tr === r && tc === c);
            const lastTo = lastMove?.to && lastMove.to[0] === r && lastMove.to[1] === c;
            const lastFrom = lastMove?.from && lastMove.from[0] === r && lastMove.from[1] === c;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onSquareClick(r, c)}
                style={{
                  ...S.cell,
                  background: sel    ? '#6c63ff'
                            : lastTo ? '#3a3a5a'
                            : lastFrom ? '#2a2a3a'
                            : dark   ? '#7d8a4c' : '#e8e0c4',
                  cursor: dark ? 'pointer' : 'default',
                }}
              >
                {p && (
                  <div style={{
                    ...S.piece,
                    background: colorOf(p) === 'r' ? '#d83b3b' : '#1a1a22',
                    border: isKing(p) ? '3px double #ffd700' : '2px solid #0006',
                  }}>{isKing(p) ? '♚' : ''}</div>
                )}
                {targ && !p && <span style={S.dot} />}
              </div>
            );
          }))}
        </div>
        {error && <div style={S.errBox}>⚠ {error}</div>}
        <div style={S.hint}>Click your piece, then a target square. Captures are mandatory.</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  surrender:{ background: '#2a0f0f', border: '1px solid #5a2a2a', color: '#ff8d8d', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  status:  { fontSize: 12, color: '#ffd166', textAlign: 'center' },
  board:   { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0, width: 400, height: 400, border: '2px solid #333', borderRadius: 4, overflow: 'hidden' },
  cell:    { display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', aspectRatio: '1 / 1', minHeight: 0 },
  piece:   { width: '70%', height: '70%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd700', fontSize: 22, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' },
  dot:     { position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: '#6c63ff', opacity: 0.6 },
  errBox:  { padding: 8, background: '#3a2410', color: '#ffc89e', borderRadius: 6, fontSize: 11, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
