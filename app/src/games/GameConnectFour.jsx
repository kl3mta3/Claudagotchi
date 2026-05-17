import { useEffect, useRef, useState } from 'react';

/**
 * Connect Four vs your pet. 7 cols × 6 rows. User = RED, pet = YELLOW.
 * Drop a disc into a column → it lands on the lowest empty cell. First to
 * connect 4 in any line (horizontal, vertical, diagonal) wins. Full board = draw.
 *
 * Pet plays via Claude (mode:'chat') — replies with a single column number 1-7.
 * Falls back to a random legal column if parse fails. Same persistence + close-
 * to-resume + Surrender pattern as the other Claude-vs-pet games.
 */

const COLS = 7;
const ROWS = 6;

function makeGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function legalCols(grid) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (!grid[0][c]) out.push(c);
  return out;
}
function dropDisc(grid, col, player) {
  // Returns { grid, row } or null if column is full.
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!grid[r][col]) {
      const g = grid.map(row => row.slice());
      g[r][col] = player;
      return { grid: g, row: r };
    }
  }
  return null;
}
function checkWin(grid, r, c, player) {
  // Returns the winning cell list, or null. Check 4 directions through (r,c).
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    for (let s = 1; s < 4; s++) {
      const nr = r + dr*s, nc = c + dc*s;
      if (grid[nr]?.[nc] === player) line.push([nr, nc]); else break;
    }
    for (let s = 1; s < 4; s++) {
      const nr = r - dr*s, nc = c - dc*s;
      if (grid[nr]?.[nc] === player) line.unshift([nr, nc]); else break;
    }
    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}
function isFull(grid) { return legalCols(grid).length === 0; }

export function GameConnectFour({ open, onEnd, petName, personalityKey, savedGame, onStateChange, model }) {
  const [grid, setGrid]       = useState(makeGrid);
  const [turn, setTurn]       = useState('r');     // 'r' user | 'b' pet (yellow)
  const [over, setOver]       = useState(null);    // 'win'|'loss'|'draw'|null
  const [winLine, setWinLine] = useState(null);
  const [lastDrop, setLastDrop] = useState(null);  // [r, c]
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);

  const accRef = useRef('');
  const reqIdRef = useRef(null);
  const sessionRef = useRef(null);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  // Live refs for stream-listener closures (stream useEffect only re-binds on
  // `open`, so reading turn/grid/over from state would always see the values
  // at the time the listener was registered — bug: pet stuck "thinking").
  const turnRef = useRef('r');
  const gridRef = useRef(grid);
  const overRef = useRef(null);
  useEffect(() => { turnRef.current = turn; }, [turn]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { overRef.current = over; }, [over]);

  // Boot — restore saved or fresh.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.grid) {
      setGrid(savedGame.grid);
      setTurn(savedGame.turn ?? 'r');
      setLastDrop(savedGame.lastDrop ?? null);
      sessionRef.current = savedGame.sessionId ?? null;
    } else {
      setGrid(makeGrid());
      setTurn('r');
      setLastDrop(null);
      sessionRef.current = null;
    }
    setOver(null); setWinLine(null); setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist after every change.
  useEffect(() => {
    if (!open) return;
    onStateChangeRef.current?.({ grid, turn, lastDrop, sessionId: sessionRef.current });
  }, [grid, turn, lastDrop, open]);

  // Restore mid-pet-turn after a reload.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.grid && savedGame.turn === 'b' && !over) setTimeout(askPet, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stream listener.
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
        applyPetDrop(accRef.current);
        accRef.current = '';
      }
    });
    return unsub;
  }, [open]);

  function tryDrop(col, player) {
    const out = dropDisc(grid, col, player);
    if (!out) return false;
    setGrid(out.grid);
    setLastDrop([out.row, col]);
    const w = checkWin(out.grid, out.row, col, player);
    if (w) {
      setWinLine(w);
      setOver(player === 'r' ? 'win' : 'loss');
      return true;
    }
    if (isFull(out.grid)) { setOver('draw'); return true; }
    setTurn(player === 'r' ? 'b' : 'r');
    return true;
  }

  function applyPetDrop(raw) {
    // Hard guard against duplicate close events playing a second move.
    // Read via refs because this is called from a stream listener whose
    // closure was captured at modal-open time.
    if (turnRef.current !== 'b' || overRef.current) return;
    setBusy(false);
    const liveGrid = gridRef.current;
    const legal = legalCols(liveGrid);
    if (!legal.length) return;
    // Find a single column number 1-7 in the response, prefer the last one.
    const matches = (raw || '').match(/\b[1-7]\b/g) || [];
    let col = null;
    for (let i = matches.length - 1; i >= 0; i--) {
      const c = parseInt(matches[i], 10) - 1;
      if (legal.includes(c)) { col = c; break; }
    }
    if (col == null) {
      col = legal[Math.floor(Math.random() * legal.length)];
      setError(`Pet's pick was unclear ("${(raw || '').slice(0, 30)}…") — picked a random legal column.`);
    }
    // Apply against the LIVE grid so we don't stomp the user's prior move.
    const out = dropDisc(liveGrid, col, 'b');
    if (!out) return;
    setGrid(out.grid);
    setLastDrop([out.row, col]);
    const w = checkWin(out.grid, out.row, col, 'b');
    if (w) { setWinLine(w); setOver('loss'); return; }
    if (isFull(out.grid)) { setOver('draw'); return; }
    setTurn('r');
  }

  async function askPet() {
    if (!window.claudigotchi) return;
    setBusy(true); setError(null); accRef.current = '';
    const reqId = `c4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    reqIdRef.current = reqId;
    const liveGrid = gridRef.current;
    const legal = legalCols(liveGrid).map(c => c + 1);
    const summary = gridSummary(liveGrid);
    const sys = [
      `You ARE ${petName || 'the pet'}. Personality: ${personalityKey || 'peppy'}.`,
      `You are playing Connect Four as YELLOW (Y). User is RED (R).`,
      `Board (top row = top of grid, columns numbered 1-7):`,
      summary,
      ``,
      `Legal columns: ${legal.join(', ')}`,
      ``,
      `Reply with ONLY ONE number from the legal list (e.g. "4"). No commentary.`,
    ].join('\n');
    try {
      const res = await window.claudigotchi.claudeSend({
        message: sys,
        sessionId: sessionRef.current,
        cwd: null, mode: 'chat',
        requestId: reqId,
        enableThinking: false,
        ...(model ? { model } : {}),
      });
      if (res?.sessionId) sessionRef.current = res.sessionId;
      if (res?.error) { setError(`Send failed: ${res.error}`); applyPetDrop(''); }
    } catch (e) {
      setError(`Send failed: ${e.message || e}`);
      applyPetDrop('');
    }
  }

  function gridSummary(g) {
    const lines = [];
    for (let r = 0; r < ROWS; r++) {
      lines.push(g[r].map(p => p === 'r' ? 'R' : p === 'b' ? 'Y' : '.').join(' '));
    }
    lines.push('1 2 3 4 5 6 7');
    return lines.join('\n');
  }

  // Kick off pet's move after the user plays.
  useEffect(() => {
    if (!open || over) return;
    if (turn === 'b' && !busy) setTimeout(askPet, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, open, over]);

  function userDrop(col) {
    if (over || turn !== 'r' || busy) return;
    tryDrop(col, 'r');
  }

  if (!open) return null;
  const status = over === 'win'  ? '🏆 You won!'
              : over === 'loss' ? '😵 Pet won — try again'
              : over === 'draw' ? '🤝 Draw'
              : busy             ? `${petName || 'Pet'} is thinking…`
              : turn === 'r'     ? `Your move (red) — click a column`
                                 : `${petName || 'Pet'}'s move`;

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🔴🟡 Connect Four vs {petName || 'pet'}</h2>
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
        {/* Column-drop strip — click any column header (or any cell in column). */}
        <div style={S.colBar}>
          {Array.from({ length: COLS }, (_, c) => {
            const enabled = !over && turn === 'r' && !busy && grid[0][c] == null;
            return (
              <button
                key={c}
                onClick={() => userDrop(c)}
                disabled={!enabled}
                style={{ ...S.colBtn, cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.4 }}
                title={`Drop in column ${c + 1}`}
              >▼</button>
            );
          })}
        </div>
        <div style={S.board}>
          {grid.map((row, r) => row.map((cell, c) => {
            const inWin = winLine?.some(([wr, wc]) => wr === r && wc === c);
            const isLast = lastDrop && lastDrop[0] === r && lastDrop[1] === c;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => userDrop(c)}
                style={{
                  ...S.slot,
                  cursor: !over && turn === 'r' && !busy && grid[0][c] == null ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  ...S.disc,
                  background: cell === 'r' ? '#d83b3b' : cell === 'b' ? '#ffd166' : '#0c1424',
                  boxShadow: cell ? 'inset 0 -3px 6px rgba(0,0,0,0.35)' : 'inset 0 2px 6px rgba(0,0,0,0.6)',
                  border: inWin ? '3px solid #7fffd4' : isLast ? '2px solid #fff8' : '2px solid #1a2a3a',
                }} />
              </div>
            );
          }))}
        </div>
        {error && <div style={S.errBox}>⚠ {error}</div>}
        <div style={S.hint}>Click ▼ above a column (or any cell in it) to drop your disc.</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  surrender:{ background: '#2a0f0f', border: '1px solid #5a2a2a', color: '#ff8d8d', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  status:  { fontSize: 12, color: '#ffd166', textAlign: 'center' },
  colBar:  { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '0 2px' },
  colBtn:  { background: 'transparent', border: 'none', color: '#888', fontSize: 14, padding: 2, fontFamily: 'inherit' },
  board:   { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 6, background: '#1f4f9e', borderRadius: 8, width: 392 },
  slot:    { aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  disc:    { width: '85%', height: '85%', borderRadius: '50%' },
  errBox:  { padding: 8, background: '#3a2410', color: '#ffc89e', borderRadius: 6, fontSize: 11, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
