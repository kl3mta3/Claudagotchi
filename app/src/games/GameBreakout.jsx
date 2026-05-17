import { useEffect, useRef, useState } from 'react';

/**
 * Breakout — paddle (mouse), ball (physics), 5 rows of bricks.
 * Pure canvas, no deps. On clearing all bricks: +25 happiness signal via onEnd.
 */
const W = 360, H = 280;
const PADDLE_W = 60, PADDLE_H = 8;
const BALL_R = 5;
const ROWS = 5, COLS = 8, BRICK_PAD = 4;
const BRICK_W = Math.floor((W - (COLS + 1) * BRICK_PAD) / COLS);
const BRICK_H = 14;

export function GameBreakout({ open, onEnd }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const rafRef    = useRef(null);
  const [over, setOver]   = useState(null); // 'won'|'lost'|null
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bricks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: BRICK_PAD + c * (BRICK_W + BRICK_PAD),
        y: BRICK_PAD + 20 + r * (BRICK_H + BRICK_PAD),
        w: BRICK_W, h: BRICK_H,
        color: `hsl(${(r * 60) % 360}, 70%, 55%)`,
        alive: true,
      });
    }
    stateRef.current = {
      paddleX: W / 2 - PADDLE_W / 2,
      ball: { x: W / 2, y: H - 40, vx: 2.2, vy: -2.6 },
      bricks,
      score: 0,
      lives: 3,
    };
    setScore(0); setOver(null);

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    }
    canvas.addEventListener('mousemove', onMove);

    function loop() {
      const s = stateRef.current;
      if (!s) return;
      // physics
      s.ball.x += s.ball.vx; s.ball.y += s.ball.vy;
      if (s.ball.x < BALL_R || s.ball.x > W - BALL_R) s.ball.vx *= -1;
      if (s.ball.y < BALL_R) s.ball.vy *= -1;
      // paddle hit
      if (s.ball.y > H - PADDLE_H - BALL_R - 4 && s.ball.y < H && s.ball.x > s.paddleX && s.ball.x < s.paddleX + PADDLE_W) {
        s.ball.vy = -Math.abs(s.ball.vy);
        // add angle based on hit position
        s.ball.vx = ((s.ball.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)) * 3.2;
      }
      // bricks
      for (const b of s.bricks) {
        if (!b.alive) continue;
        if (s.ball.x > b.x && s.ball.x < b.x + b.w && s.ball.y > b.y && s.ball.y < b.y + b.h) {
          b.alive = false;
          s.score += 10;
          setScore(s.score);
          s.ball.vy *= -1;
          break;
        }
      }
      // lose life
      if (s.ball.y > H) {
        s.lives -= 1;
        if (s.lives <= 0) { setOver('lost'); cancelAnimationFrame(rafRef.current); rafRef.current = null; return; }
        s.ball.x = W / 2; s.ball.y = H - 40; s.ball.vx = 2.2; s.ball.vy = -2.6;
      }
      // win
      if (s.bricks.every(b => !b.alive)) {
        setOver('won'); cancelAnimationFrame(rafRef.current); rafRef.current = null; return;
      }
      // render
      ctx.fillStyle = '#0c0c12'; ctx.fillRect(0, 0, W, H);
      for (const b of s.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.paddleX, H - PADDLE_H - 4, PADDLE_W, PADDLE_H);
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#888'; ctx.font = '11px Consolas, monospace';
      ctx.fillText(`Score ${s.score}   Lives ${s.lives}`, 6, 14);

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.header}>
          <h2 style={S.title}>🧱 Breakout</h2>
          <div style={S.score}>Score: {score}</div>
          <button style={S.close} onClick={() => onEnd?.({ won: over === 'won', score })}>✕</button>
        </div>
        <canvas ref={canvasRef} width={W} height={H} style={{ background: '#0c0c12', borderRadius: 6, cursor: 'none' }} />
        {over === 'won' && <div style={S.win}>🎉 Board cleared!</div>}
        {over === 'lost' && <div style={S.lose}>Game over — final score {score}</div>}
        <div style={S.hint}>Move your mouse to control the paddle.</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { background: '#111', border: '1px solid #222', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  header:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  score:   { fontSize: 12, color: '#ffd166', fontFamily: 'Consolas, monospace' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  win:     { padding: 10, background: '#1a3a2a', color: '#7fffd4', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  lose:    { padding: 10, background: '#3a1a1a', color: '#ff8d8d', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  hint:    { fontSize: 11, color: '#666', textAlign: 'center' },
};
