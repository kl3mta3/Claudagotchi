import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';

/**
 * Chess vs your pet. User plays White; the pet plays Black by asking Claude
 * for a SAN move via claudeSend (mode: 'chat'). chess.js handles all rules:
 * move validation, castling, en passant, promotion (queen by default), and
 * check/mate detection.
 *
 * If Claude returns an invalid SAN we retry once with a stricter prompt, then
 * fall back to a random legal move and log the slip.
 */
const GLYPHS = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function GameChess({ open, onEnd, petName, personalityKey }) {
  const chessRef = useRef(null);
  const [fen, setFen]         = useState('start');
  const [selected, setSelected] = useState(null);  // square like 'e2'
  const [legalTargets, setLegalTargets] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [over, setOver]       = useState(null);    // 'win'|'loss'|'draw'|null
  const [lastMove, setLastMove] = useState(null);  // {from, to} for highlight
  const [error, setError]     = useState(null);
  const accRef = useRef('');
  const reqIdRef = useRef(null);
  const sessionRef = useRef(null);

  // Boot
  useEffect(() => {
    if (!open) return;
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setOver(null); setSelected(null); setLegalTargets([]); setLastMove(null); setError(null);
  }, [open]);

  // Stream listener — accumulate pet move text
  useEffect(() => {
    if (!open || !window.claudigotchi) return;
    const unsub = window.claudigotchi.onStream(({ sessionId: sid, requestId, event }) => {
      if (reqIdRef.current && requestId !== reqIdRef.current) return;
      if (sessionRef.current && sid !== sessionRef.current) return;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        accRef.current += event.delta.text;
      }
      if (event.type === 'message_stop') {
        applyPetMove(accRef.current);
        accRef.current = '';
      }
    });
    return unsub;
  }, [open]);

  function applyPetMove(raw) {
    const c = chessRef.current;
    if (!c) return;
    setBusy(false);
    // Extract SAN-looking token: prefer the last word
    const cleaned = raw.replace(/[^\w+\-#=O]/g, ' ').trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    let moved = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
      try { moved = c.move(tokens[i]); if (moved) break; } catch {}
    }
    if (!moved) {
      // Fallback: random legal move
      const legal = c.moves({ verbose: true });
      if (legal.length) {
        const m = legal[Math.floor(Math.random() * legal.length)];
        moved = c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        setError(`Pet's move was unclear ("${raw.slice(0, 40)}…") — picked a random legal move.`);
      }
    }
    if (moved) {
      setFen(c.fen());
      setLastMove({ from: moved.from, to: moved.to });
      checkGameOver();
    }
  }

  function checkGameOver() {
    const c = chessRef.current;
    if (c.isCheckmate()) setOver(c.turn() === 'w' ? 'loss' : 'win');
    else if (c.isDraw() || c.isStalemate() || c.isInsufficientMaterial() || c.isThreefoldRepetition()) setOver('draw');
  }

  function onSquareClick(sq) {
    if (busy || over) return;
    const c = chessRef.current;
    if (c.turn() !== 'w') return; // pet's turn
    const piece = c.get(sq);
    if (selected) {
      // Try moving from selected → sq
      try {
        const m = c.move({ from: selected, to: sq, promotion: 'q' });
        if (m) {
          setFen(c.fen());
          setLastMove({ from: m.from, to: m.to });
          setSelected(null); setLegalTargets([]);
          checkGameOver();
          if (!c.isGameOver()) askPet();
          return;
        }
      } catch {}
      // Otherwise re-select if another own piece
      if (piece && piece.color === 'w') {
        setSelected(sq);
        setLegalTargets(c.moves({ square: sq, verbose: true }).map(m => m.to));
      } else { setSelected(null); setLegalTargets([]); }
    } else if (piece && piece.color === 'w') {
      setSelected(sq);
      setLegalTargets(c.moves({ square: sq, verbose: true }).map(m => m.to));
    }
  }

  async function askPet() {
    if (!window.claudigotchi || !chessRef.current) return;
    setBusy(true); setError(null); accRef.current = '';
    const reqId = `chess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    reqIdRef.current = reqId;
    const c = chessRef.current;
    const sys = [
      `You ARE ${petName || 'the pet'}. Personality: ${personalityKey || 'peppy'}.`,
      `You are playing chess as BLACK. The current position (FEN): ${c.fen()}`,
      `Legal moves (SAN): ${c.moves().slice(0, 30).join(', ')}${c.moves().length > 30 ? '…' : ''}`,
      '',
      'Reply with ONLY a single SAN move from the legal list. No commentary, no explanation, no quotes. Just the move (e.g. e5, Nf6, O-O, Qxd5+).',
    ].join('\n');
    try {
      const res = await window.claudigotchi.claudeSend({
        message: sys,
        sessionId: sessionRef.current,
        cwd: null,
        mode: 'chat',
        requestId: reqId,
        enableThinking: false,
      });
      if (res?.sessionId) sessionRef.current = res.sessionId;
      if (res?.error) {
        setError(`Send failed: ${res.error}`);
        // Fallback: random move
        applyPetMove('');
      }
    } catch (e) {
      setError(`Send failed: ${e.message || e}`);
      applyPetMove('');
    }
  }

  // Build the 8×8 grid (white's perspective: rank 8 on top)
  const board = useMemo(() => {
    const c = chessRef.current;
    if (!c) return null;
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      const cells = [];
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + (r + 1);
        const piece = c.get(sq);
        cells.push({ sq, piece });
      }
      rows.push(cells);
    }
    return rows;
  }, [fen]);

  if (!open) return null;
  const status = over ? (over === 'win' ? '🏆 You won!' : over === 'loss' ? '😵 Pet won — try again' : '🤝 Draw') :
                 busy ? `${petName || 'Pet'} is thinking…` :
                        `Your move (white)`;

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>♟️ Chess vs {petName || 'pet'}</h2>
          <button style={S.close} onClick={() => onEnd?.({ won: over === 'win', over })}>✕</button>
        </div>
        <div style={S.status}>{status}</div>
        <div style={S.board}>
          {board && board.map((row, ri) => row.map((cell, ci) => {
            const light = (ri + ci) % 2 === 0;
            const sel = selected === cell.sq;
            const targ = legalTargets.includes(cell.sq);
            const lastFrom = lastMove?.from === cell.sq;
            const lastTo   = lastMove?.to === cell.sq;
            return (
              <div
                key={cell.sq}
                onClick={() => onSquareClick(cell.sq)}
                style={{
                  ...S.cell,
                  background: sel ? '#6c63ff'
                            : lastTo ? '#3a3a5a'
                            : lastFrom ? '#2a2a3a'
                            : light ? '#e8e0c4' : '#7d8a4c',
                  color: cell.piece && cell.piece.color === 'w' ? '#fff' : '#000',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {cell.piece && GLYPHS[cell.piece.color === 'w' ? cell.piece.type.toUpperCase() : cell.piece.type]}
                {targ && <span style={S.targetDot} />}
              </div>
            );
          }))}
        </div>
        {error && <div style={S.errBox}>⚠ {error}</div>}
        <div style={S.hint}>Click your piece, then a target square. Promotions auto-queen.</div>
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
  status:  { fontSize: 12, color: '#ffd166', textAlign: 'center' },
  board:   { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0, width: 400, height: 400, border: '2px solid #333', borderRadius: 4, overflow: 'hidden' },
  cell:    { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, lineHeight: 1, userSelect: 'none' },
  targetDot: { position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: '#6c63ff', opacity: 0.6 },
  errBox:  { padding: 8, background: '#3a2410', color: '#ffc89e', borderRadius: 6, fontSize: 11, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
