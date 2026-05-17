import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Battleship vs your pet. 8×8 board, four ships per side (sizes 4, 3, 2, 2).
 *
 *   Phase 1 — placement: user clicks tiles on their own grid to place each
 *             ship in order. Press R (or click the rotate button) to flip
 *             horizontal ↔ vertical. Pet auto-places random non-overlapping.
 *   Phase 2 — firing: user clicks the pet's grid to fire. Hit, miss, or sunk
 *             is reported. Pet's turn: asks Claude for a coord like "C5";
 *             after a hit, hunts adjacent squares until sunk (state machine).
 *
 * Win = sink the opponent's whole fleet first.
 *
 * Persistence shape (parent owns):
 *   {
 *     phase:    'place'|'play',
 *     turn:     'r'|'b',
 *     userShips: [{cells:[[r,c]...], hits:[[r,c]...], sunk:bool}],
 *     petShips:  [...same...],
 *     userShots: { 'r,c': 'hit'|'miss' },   // shots PET fired at user
 *     petShots:  { 'r,c': 'hit'|'miss' },   // shots USER fired at pet
 *     hunt:     { mode:'hunt'|'target', stack:[[r,c]...] },  // pet AI memory
 *     sessionId: string,
 *   }
 */

const SIZE = 8;
const FILES = ['A','B','C','D','E','F','G','H'];
const SHIP_SIZES = [4, 3, 2, 2]; // carrier, sub, destroyer, patrol

function emptyShots() { return {}; }
function sqKey(r, c)  { return `${r},${c}`; }
function parseSqKey(k){ const [r,c] = k.split(',').map(Number); return [r,c]; }
function labelOf(r,c) { return FILES[c] + (r + 1); }
function parseLabel(s){
  if (!s) return null;
  const m = s.trim().toUpperCase().match(/^([A-H])\s*(\d+)$/);
  if (!m) return null;
  const c = FILES.indexOf(m[1]);
  const r = parseInt(m[2], 10) - 1;
  if (c < 0 || r < 0 || r >= SIZE) return null;
  return [r, c];
}

function tryPlaceShip(ships, r, c, size, horiz) {
  const cells = [];
  for (let i = 0; i < size; i++) cells.push(horiz ? [r, c + i] : [r + i, c]);
  // Bounds check
  for (const [rr, cc] of cells) if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return null;
  // Overlap check
  const taken = new Set();
  for (const s of ships) for (const [rr, cc] of s.cells) taken.add(sqKey(rr, cc));
  for (const [rr, cc] of cells) if (taken.has(sqKey(rr, cc))) return null;
  return { cells, hits: [], sunk: false };
}

function randomPetFleet() {
  const ships = [];
  for (const size of SHIP_SIZES) {
    let placed = null;
    for (let tries = 0; tries < 500 && !placed; tries++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      placed = tryPlaceShip(ships, r, c, size, horiz);
    }
    if (placed) ships.push(placed);
  }
  return ships;
}

function allSunk(ships) { return ships.length > 0 && ships.every(s => s.sunk); }

function applyShot(ships, shotsMap, r, c) {
  // Returns { ships, shotsMap, result:'hit'|'miss'|'sunk'|'already', sunkShip? }
  const key = sqKey(r, c);
  if (shotsMap[key]) return { ships, shotsMap, result: 'already' };
  let result = 'miss';
  let sunkShip = null;
  const newShips = ships.map(s => {
    const idx = s.cells.findIndex(([sr, sc]) => sr === r && sc === c);
    if (idx < 0) return s;
    result = 'hit';
    const hits = [...s.hits, [r, c]];
    const sunk = hits.length === s.cells.length;
    if (sunk) { sunkShip = s; result = 'sunk'; }
    return { ...s, hits, sunk };
  });
  return {
    ships: newShips,
    shotsMap: { ...shotsMap, [key]: result === 'miss' ? 'miss' : 'hit' },
    result, sunkShip,
  };
}

/** Pet AI for picking a target. Simple hunt/target mode. */
function pickPetTarget(petShots, hunt) {
  // 'target' mode: pop from the stack of adjacent squares around recent hits.
  if (hunt?.mode === 'target' && hunt.stack?.length) {
    for (let i = hunt.stack.length - 1; i >= 0; i--) {
      const [r, c] = hunt.stack[i];
      if (!petShots[sqKey(r, c)]) return [r, c];
    }
  }
  // 'hunt' mode: any untried square (parity bias to skip wasted shots).
  const candidates = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (petShots[sqKey(r, c)]) continue;
      // Bias toward checker-pattern squares (every other) for hunt efficiency.
      if ((r + c) % 2 === 0) candidates.push([r, c, 1]);
      else                    candidates.push([r, c, 0.3]);
    }
  if (!candidates.length) return null;
  const total = candidates.reduce((a, [,,w]) => a + w, 0);
  let pick = Math.random() * total;
  for (const [r, c, w] of candidates) { pick -= w; if (pick <= 0) return [r, c]; }
  const [r, c] = candidates[0];
  return [r, c];
}

export function GameBattleship({ open, onEnd, petName, personalityKey, savedGame, onStateChange, model }) {
  const [phase, setPhase]   = useState('place');   // 'place' | 'play'
  const [turn, setTurn]     = useState('r');        // 'r' = user, 'b' = pet
  const [userShips, setUserShips] = useState([]);   // placed by user
  const [petShips,  setPetShips]  = useState([]);   // placed by pet
  const [userShots, setUserShots] = useState({});   // shots PET fired at user
  const [petShots,  setPetShots]  = useState({});   // shots USER fired at pet
  const [hunt, setHunt]     = useState({ mode: 'hunt', stack: [] });
  const [placeIdx, setPlaceIdx] = useState(0);
  const [horiz, setHoriz]   = useState(true);
  const [hover, setHover]   = useState(null);       // [r,c] preview while placing
  const [busy, setBusy]     = useState(false);
  const [over, setOver]     = useState(null);       // 'win'|'loss'|null
  const [lastEvent, setLastEvent] = useState('');   // tooltip-ish status
  const [error, setError]   = useState(null);

  const accRef = useRef('');
  const reqIdRef = useRef(null);
  const sessionRef = useRef(null);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  // Live refs for stream-listener closures (bound once on `open`, so reading
  // turn/phase/state directly would always see open-time values — bug: pet
  // stuck "aiming" because applyPetShot saw turn === 'r' from registration).
  const turnRef = useRef('r');
  const userShipsRef = useRef([]);
  const userShotsRef = useRef({});
  const huntRef = useRef({ mode: 'hunt', stack: [] });
  const overRef = useRef(null);
  useEffect(() => { turnRef.current      = turn;      }, [turn]);
  useEffect(() => { userShipsRef.current = userShips; }, [userShips]);
  useEffect(() => { userShotsRef.current = userShots; }, [userShots]);
  useEffect(() => { huntRef.current      = hunt;      }, [hunt]);
  useEffect(() => { overRef.current      = over;      }, [over]);

  // Boot — restore saved or fresh.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.phase) {
      setPhase(savedGame.phase);
      setTurn(savedGame.turn ?? 'r');
      setUserShips(savedGame.userShips ?? []);
      setPetShips(savedGame.petShips ?? []);
      setUserShots(savedGame.userShots ?? {});
      setPetShots(savedGame.petShots ?? {});
      setHunt(savedGame.hunt ?? { mode: 'hunt', stack: [] });
      sessionRef.current = savedGame.sessionId ?? null;
    } else {
      setPhase('place'); setTurn('r');
      setUserShips([]); setPetShips([]);
      setUserShots({}); setPetShots({});
      setHunt({ mode: 'hunt', stack: [] });
      sessionRef.current = null;
    }
    setPlaceIdx(0); setHoriz(true); setHover(null);
    setBusy(false); setOver(null); setLastEvent(''); setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist on visible changes.
  useEffect(() => {
    if (!open) return;
    onStateChangeRef.current?.({
      phase, turn, userShips, petShips, userShots, petShots, hunt,
      sessionId: sessionRef.current,
    });
  }, [phase, turn, userShips, petShips, userShots, petShots, hunt, open]);

  // R-key to rotate during placement.
  useEffect(() => {
    if (!open || phase !== 'place') return;
    const onKey = (e) => { if (e.key === 'r' || e.key === 'R') setHoriz(h => !h); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase]);

  // Win/loss detection.
  useEffect(() => {
    if (!open || phase !== 'play' || over) return;
    if (allSunk(petShips))  { setOver('win');  return; }
    if (allSunk(userShips)) { setOver('loss'); return; }
  }, [petShips, userShips, phase, open, over]);

  // Pet's turn → ask Claude.
  useEffect(() => {
    if (!open || phase !== 'play' || over) return;
    if (turn === 'b' && !busy) setTimeout(askPet, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, open, over]);

  // Restore mid-pet-turn after a reload.
  useEffect(() => {
    if (!open) return;
    if (savedGame?.phase === 'play' && savedGame.turn === 'b' && !allSunk(savedGame.userShips || [])) {
      setTimeout(askPet, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stream listener for pet shot.
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
        applyPetShot(accRef.current);
        accRef.current = '';
      }
    });
    return unsub;
  }, [open]);

  function applyPetShot(raw) {
    // Use refs — stream listener closure is stale otherwise.
    if (turnRef.current !== 'b' || overRef.current) return;
    setBusy(false);
    const liveShips = userShipsRef.current;
    const liveShots = userShotsRef.current;
    const liveHunt  = huntRef.current;
    // Prefer hunt-stack target over whatever Claude said (if we're targeting),
    // but if Claude returned a valid untried label, accept it.
    let target = null;
    const tokens = (raw || '').toUpperCase().match(/[A-H]\d+/g) || [];
    for (let i = tokens.length - 1; i >= 0 && !target; i--) {
      const q = parseLabel(tokens[i]);
      if (q && !liveShots[sqKey(q[0], q[1])]) target = q;
    }
    if (!target) target = pickPetTarget(liveShots, liveHunt);
    if (!target) return; // no squares left (shouldn't happen)

    const [r, c] = target;
    const out = applyShot(liveShips, liveShots, r, c);
    setUserShips(out.ships);
    setUserShots(out.shotsMap);
    const remainingYours = out.ships.filter(s => !s.sunk).length;
    const msg = out.result === 'sunk'
      ? `💀 Pet SUNK your size-${out.sunkShip.cells.length} ship — ${remainingYours} of yours left`
      : `Pet fired at ${labelOf(r, c)} — ${out.result}`;
    setLastEvent(msg);

    // Update hunt AI memory.
    if (out.result === 'hit' || out.result === 'sunk') {
      if (out.result === 'sunk') {
        setHunt({ mode: 'hunt', stack: [] });
      } else {
        const adj = [[-1,0],[1,0],[0,-1],[0,1]].map(([dr, dc]) => [r + dr, c + dc])
          .filter(([rr, cc]) => rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && !out.shotsMap[sqKey(rr, cc)]);
        setHunt(h => ({ mode: 'target', stack: [...h.stack, ...adj] }));
      }
    }
    setTurn('r');
  }

  async function askPet() {
    if (!window.claudigotchi) return;
    setBusy(true); setError(null); accRef.current = '';
    const reqId = `battleship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    reqIdRef.current = reqId;
    // Compact summary of where pet has shot already + hit/miss results.
    const shotList = Object.entries(userShots)
      .map(([k, v]) => { const [r, c] = parseSqKey(k); return `${labelOf(r, c)}=${v}`; });
    const sys = [
      `You ARE ${petName || 'the pet'}. Personality: ${personalityKey || 'peppy'}.`,
      `You are playing Battleship vs the user on an 8×8 board (columns A-H, rows 1-8).`,
      `Your previous shots and outcomes: ${shotList.join(' ') || '(none)'}`,
      `Strategy: if you have unsunk hits, target adjacent squares. Otherwise hunt empty squares.`,
      ``,
      `Reply with ONLY one coordinate like "C5" — a square you have NOT shot at yet. No commentary.`,
    ].join('\n');
    try {
      const res = await window.claudigotchi.claudeSend({
        message: sys,
        sessionId: null,        // fresh per shot — full shot history is in the prompt
        cwd: null, mode: 'chat',
        requestId: reqId,
        enableThinking: false,
        ...(model ? { model } : {}),
      });
      if (res?.error) { setError(`Send failed: ${res.error}`); applyPetShot(''); }
    } catch (e) {
      setError(`Send failed: ${e.message || e}`);
      applyPetShot('');
    }
  }

  // ── Placement ────────────────────────────────────────────────────────────
  const currentSize = SHIP_SIZES[placeIdx];
  function placeAt(r, c) {
    const ship = tryPlaceShip(userShips, r, c, currentSize, horiz);
    if (!ship) { setLastEvent('Invalid placement — out of bounds or overlap'); return; }
    const next = [...userShips, ship];
    setUserShips(next);
    if (next.length >= SHIP_SIZES.length) {
      // Finalize placement: pet auto-places its fleet (random non-overlapping),
      // switch to firing phase. Give clear UI confirmation.
      const fleet = randomPetFleet();
      setPetShips(fleet);
      setPhase('play');
      setLastEvent(`✅ All ${SHIP_SIZES.length} ships placed. Pet's fleet hidden — fire at its grid →`);
    } else {
      setPlaceIdx(placeIdx + 1);
      setLastEvent(`Ship placed (${next.length}/${SHIP_SIZES.length}). Next: size ${SHIP_SIZES[placeIdx + 1]}`);
    }
  }
  // Cells occupied by user's fleet (for own-board rendering).
  const userOccupied = useMemo(() => {
    const m = new Set();
    for (const s of userShips) for (const [r, c] of s.cells) m.add(sqKey(r, c));
    return m;
  }, [userShips]);

  // Preview cells while hovering during placement.
  const previewCells = useMemo(() => {
    if (phase !== 'place' || !hover) return new Set();
    const [r, c] = hover;
    const m = new Set();
    for (let i = 0; i < currentSize; i++) {
      const [rr, cc] = horiz ? [r, c + i] : [r + i, c];
      if (rr < SIZE && cc < SIZE) m.add(sqKey(rr, cc));
    }
    return m;
  }, [hover, horiz, currentSize, phase]);

  // ── Firing ───────────────────────────────────────────────────────────────
  function fireAt(r, c) {
    if (phase !== 'play' || over || turn !== 'r' || busy) return;
    const key = sqKey(r, c);
    if (petShots[key]) return;
    const out = applyShot(petShips, petShots, r, c);
    setPetShips(out.ships);
    setPetShots(out.shotsMap);
    const remaining = out.ships.filter(s => !s.sunk).length;
    const msg = out.result === 'sunk'
      ? `🔥 SUNK! You destroyed a size-${out.sunkShip.cells.length} ship — ${remaining} of pet's ships left`
      : `You fired at ${labelOf(r, c)} — ${out.result}`;
    setLastEvent(msg);
    setTurn('b');
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function renderOwnBoard() {
    const sunkCells = new Set();
    for (const s of userShips) if (s.sunk) for (const [sr, sc] of s.cells) sunkCells.add(sqKey(sr, sc));
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const key = sqKey(r, c);
      const isShip   = userOccupied.has(key);
      const isShot   = userShots[key];
      const isPreview= previewCells.has(key);
      const isSunk   = sunkCells.has(key);
      const validPreview = isPreview && !isShip && (phase === 'place');
      cells.push(
        <div
          key={key}
          onClick={() => phase === 'place' && placeAt(r, c)}
          onMouseEnter={() => phase === 'place' && setHover([r, c])}
          onMouseLeave={() => phase === 'place' && setHover(null)}
          style={{
            ...S.cell,
            background: validPreview ? 'rgba(120,180,255,0.4)'
                     : isSunk        ? '#7a1d10'
                     : isShot === 'hit'  ? '#d83b3b'
                     : isShot === 'miss' ? '#465'
                     : isShip ? '#557'
                     : '#1a2a3a',
            border: isSunk ? '1px solid #ff4500' : '1px solid transparent',
            cursor: phase === 'place' ? 'pointer' : 'default',
          }}
        >
          {isSunk          ? '💀'
           : isShot === 'hit'  ? '💥'
           : isShot === 'miss' ? '•' : ''}
        </div>
      );
    }
    return cells;
  }
  function renderPetBoard() {
    // Pre-compute which cells belong to a SUNK pet ship — those render with a
    // distinct "destroyed" look so the user can see the ship is gone, not
    // just damaged. Same trick on the user's own board (renderOwnBoard).
    const sunkCells = new Set();
    for (const s of petShips) if (s.sunk) for (const [sr, sc] of s.cells) sunkCells.add(sqKey(sr, sc));
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const key = sqKey(r, c);
      const shot = petShots[key];
      const isSunk = sunkCells.has(key);
      cells.push(
        <div
          key={key}
          onClick={() => fireAt(r, c)}
          style={{
            ...S.cell,
            background: isSunk           ? '#7a1d10'
                     : shot === 'hit'  ? '#d83b3b'
                     : shot === 'miss' ? '#465'
                     : '#1a2a3a',
            border: isSunk ? '1px solid #ff4500' : '1px solid transparent',
            cursor: phase === 'play' && !over && turn === 'r' && !shot && !busy ? 'crosshair' : 'default',
          }}
        >
          {isSunk          ? '💀'
           : shot === 'hit'  ? '💥'
           : shot === 'miss' ? '•' : ''}
        </div>
      );
    }
    return cells;
  }

  if (!open) return null;
  const status = over ? (over === 'win' ? '🏆 You sank the fleet!' : '😵 Pet sank your fleet') :
                 phase === 'place' ? `Place ship ${placeIdx + 1}/${SHIP_SIZES.length} (size ${currentSize}, ${horiz ? 'horizontal' : 'vertical'} — R to rotate)` :
                 busy ? `${petName || 'Pet'} is aiming…` :
                 turn === 'r' ? `Your turn — fire at the pet's grid` : `${petName || 'Pet'}'s turn`;

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🚢 Battleship vs {petName || 'pet'}</h2>
          {phase === 'place' && (
            <button style={S.rotateBtn} onClick={() => setHoriz(h => !h)} title="Rotate (or press R)">↻ Rotate</button>
          )}
          {!over && phase === 'play' && (
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
        <div style={S.boards}>
          <div>
            <div style={S.boardLabel}>Your fleet</div>
            <div style={S.grid}>{renderOwnBoard()}</div>
          </div>
          <div>
            <div style={S.boardLabel}>Pet's waters</div>
            <div style={S.grid}>{renderPetBoard()}</div>
          </div>
        </div>
        {lastEvent && <div style={S.event}>{lastEvent}</div>}
        {error && <div style={S.errBox}>⚠ {error}</div>}
        <div style={S.hint}>{phase === 'place' ? 'Click your grid to place each ship.' : 'Click the pet\'s grid to fire.'}</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  rotateBtn:{ background: '#15151b', border: '1px solid #2a2a3a', color: '#ddd', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  surrender:{ background: '#2a0f0f', border: '1px solid #5a2a2a', color: '#ff8d8d', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  status:  { fontSize: 12, color: '#ffd166', textAlign: 'center' },
  boards:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  boardLabel: { fontSize: 10, color: '#888', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 1, background: '#000', padding: 1, border: '2px solid #333', borderRadius: 4, width: 256, height: 256 },
  cell:    { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1, userSelect: 'none', aspectRatio: '1 / 1', minHeight: 0, color: '#fff' },
  event:   { fontSize: 11, color: '#9ad', textAlign: 'center' },
  errBox:  { padding: 8, background: '#3a2410', color: '#ffc89e', borderRadius: 6, fontSize: 11, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
