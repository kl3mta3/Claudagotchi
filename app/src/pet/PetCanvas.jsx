import { useEffect, useRef, useState } from 'react';
import { PERSONALITIES } from '../engine/Personalities.js';
import { ChatBubble } from './ChatBubble.jsx';

/**
 * PetCanvas.jsx
 * Renders the pet as inline SVG and animates it walking around the environment.
 *
 * Props:
 *   appearance         — full appearance object from PetGenerator
 *   stage              — 0..4
 *   mood               — see MOOD_ANIM
 *   evolutionScore     — for egg cracking
 *   clothing           — array of equipped clothing items (Phase 8: { id, slot:'head'|'body'|'arms'|'feet' })
 *   inventory          — flat list of inventory entries (used to render attached toys: doll, ball)
 *   interactionTarget  — { type:'bed'|'shower'|'pc'|'food_tray'|'nap'|null, x:number, xRatio:number, ts:number } — walks to x, then enters mood
 *   onArrive           — fired the MOMENT the pet reaches the interaction target (before mood plays)
 *   onInteractionDone  — fired when the interaction-mood completes (~30s after arrival)
 *   width, height      — px canvas size
 *   speech             — optional chat-bubble text
 */
export function PetCanvas({
  appearance, stage = 0, mood = 'idle', evolutionScore = 0,
  clothing = [], inventory = [],
  interactionTarget = null, onInteractionDone = null, onArrive = null,
  width = 380, height = 140, speech = null,
  onPetClick = null,
  onBubbleDismiss = null,
  wellRestedUntil = 0,
}) {
  const [x, setX] = useState(width / 2);
  const [dir, setDir] = useState(1); // 1 right, -1 left
  const [interactionMood, setInteractionMood] = useState(null);
  const targetRef = useRef(width / 2);
  const rafRef = useRef(null);
  const interactionRef = useRef(null); // tracks current interaction id to avoid double-fire

  const personalityKey = appearance?.adult?.personalityKey || 'peppy';
  const personality = PERSONALITIES[personalityKey] || PERSONALITIES.peppy;
  const baseSpeed = personality.walkSpeed ?? 1.5;

  // A second ref tracks whether we've already FIRED the arrival/mood logic
  // for the current interaction. Without this, the step() closure's stale
  // `interactionMood` value re-fires the mood every frame at the target.
  const interactionFiredRef = useRef(false);

  // If the parent explicitly clears the interaction target while we're still
  // in an interaction mood (e.g. user clicks "Wake" mid-nap), drop the mood
  // and free the pet to roam again. Without this the pet stays glued and
  // sleeping until the original 60s timeout fires.
  useEffect(() => {
    if (!interactionTarget && interactionFiredRef.current) {
      setInteractionMood(null);
      interactionRef.current = null;
      interactionFiredRef.current = false;
    }
  }, [interactionTarget]);

  // ── Interaction target: when set, override random walking. ─────────────────
  useEffect(() => {
    if (!interactionTarget || !interactionTarget.type) return;
    const key = `${interactionTarget.type}-${interactionTarget.x}-${interactionTarget.ts || ''}`;
    if (interactionRef.current === key) return;
    interactionRef.current = key;
    interactionFiredRef.current = false;                  // new target → ready to fire
    let target;
    if (typeof interactionTarget.xRatio === 'number') {
      target = interactionTarget.xRatio * width;
    } else {
      target = interactionTarget.x || width / 2;
    }
    targetRef.current = Math.max(20, Math.min(width - 20, target));
  }, [interactionTarget, width]);

  // Walking AI
  useEffect(() => {
    if (stage === 0 || stage === 4) return;

    let idleTimer = null;
    function pickTarget() {
      const margin = 40;
      const t = margin + Math.random() * (width - 2 * margin);
      targetRef.current = t;
    }
    if (!interactionTarget?.type) pickTarget();

    function step() {
      setX(curX => {
        const target = targetRef.current;
        const delta = target - curX;
        if (Math.abs(delta) < baseSpeed) {
          // Arrived. If we were heading to an interaction, switch mood for 30-60s.
          if (interactionTarget?.type && interactionRef.current) {
            const moodMap = { bed: 'sleeping', nap: 'sleeping', shower: 'shower', pc: 'thinking', food_tray: 'eating' };
            const m = moodMap[interactionTarget.type];
            // interactionFiredRef ensures we run this block ONCE per interaction
            // (stale closure on interactionMood would otherwise re-fire it every frame).
            if (m && !interactionFiredRef.current) {
              interactionFiredRef.current = true;
              // Fire onArrive immediately so App.jsx can apply the action's
              // effect (feed the tray, run shower, start nap) the moment the
              // pet gets there. The interactionMood plays for 30-60s after.
              if (onArrive) onArrive(interactionTarget.type);
              setInteractionMood(m);
              const moodDuration = interactionTarget.type === 'nap' ? 60_000 : 30_000;
              setTimeout(() => {
                setInteractionMood(null);
                interactionRef.current = null;
                interactionFiredRef.current = false;
                if (onInteractionDone) onInteractionDone(interactionTarget.type);
              }, moodDuration);
            }
            return curX;       // stay put for the duration
          }
          if (!idleTimer) {
            idleTimer = setTimeout(() => {
              idleTimer = null;
              pickTarget();
            }, 800 + Math.random() * 2000);
          }
          return curX;
        }
        const sign = Math.sign(delta);
        setDir(sign);
        return curX + sign * baseSpeed;
      });
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (idleTimer) clearTimeout(idleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, baseSpeed, width, interactionTarget?.type, interactionTarget?.x]);

  const xc = Math.max(20, Math.min(width - 20, x));
  const effectiveMood = interactionMood || mood;
  const moodAnim = MOOD_ANIM[effectiveMood] || '';
  const bubbleX = Math.max(80, Math.min(width - 80, xc));

  // Attached toys (doll) follow the pet — render inside the transformed wrapper
  // Doll only shows when actually placed in the room (Place / Remove toggle in shop)
  const hasDoll = (inventory || []).some(i => i.id === 'doll' && i.placed !== false && (i.count ?? 1) > 0);

  // 💤 indicator — shown while sleeping OR while well-rested buff is active.
  // Re-checked on every render so it disappears when the buff expires.
  const isSleeping   = effectiveMood === 'sleeping';
  const isWellRested = Date.now() < (wellRestedUntil || 0);
  const showZzz      = (isSleeping || isWellRested) && stage !== 0 && stage !== 4;

  // Bubble sits at the TOP of the env over the pet's x. It grows downward so it
  // never escapes the env vertically (which would get clipped by overflow).
  const showBubble = !!speech && stage !== 0;
  // Cap bubble width so long text wraps cleanly instead of stretching across
  // the whole environment. ~75% of env width with a hard 280px ceiling.
  const bubbleMaxW = Math.min(Math.floor(width * 0.75), 280);
  const bubbleMaxH = Math.max(60, Math.floor(height * 0.55));

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Speech bubble — renders ABOVE pet, points down at it. */}
      {showBubble && (
        <div style={{
          position: 'absolute',
          left: bubbleX,
          top: 4,
          transform: 'translateX(-50%)',
          transition: 'left 0.4s ease',
          maxWidth: bubbleMaxW,
          zIndex: 5,
        }}>
          <BubbleDown
            text={speech}
            personalityKey={personalityKey}
            maxHeight={bubbleMaxH}
            onDismiss={onBubbleDismiss}
          />
        </div>
      )}

      {/* 💤 floating above the pet's head: big & rhythmic while actively
          sleeping, small & subtle while the well-rested buff lingers. */}
      {showZzz && (
        <div style={{
          position: 'absolute',
          left: xc, bottom: Math.min(height - 28, 110),
          transform: 'translateX(-50%)',
          fontSize: isSleeping ? 18 : 13,
          opacity: isSleeping ? 1 : 0.55,
          pointerEvents: 'none',
          animation: isSleeping ? 'cgZzzBig 1.6s ease-in-out infinite' : 'cgZzzSmall 2.4s ease-in-out infinite',
          zIndex: 3,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))',
          letterSpacing: 1,
        }}>💤</div>
      )}

      {/* Pet sprite — onClick goes directly on the SVG wrapper so we don't
          steal clicks from draggable furniture beneath the pet's roaming area. */}
      <div
        onClick={onPetClick && stage !== 0 && stage !== 4 ? (e) => { e.stopPropagation(); onPetClick(); } : undefined}
        title={onPetClick && stage !== 0 && stage !== 4 ? 'click to greet your pet' : undefined}
        style={{
          position: 'absolute',
          left: xc, bottom: 8,
          transform: `translateX(-50%) scaleX(${dir})`,
          transformOrigin: 'center bottom',
          animation: moodAnim,
          cursor: onPetClick && stage !== 0 && stage !== 4 ? 'pointer' : 'default',
          pointerEvents: stage === 0 || stage === 4 ? 'none' : 'auto',
        }}>
        {stage === 0 && <EggSVG appearance={appearance} evolutionScore={evolutionScore} />}
        {stage === 1 && <HatchlingSVG appearance={appearance} mood={effectiveMood} clothing={clothing} />}
        {stage === 2 && <AdolescentSVG appearance={appearance} mood={effectiveMood} clothing={clothing} stage={stage} />}
        {stage === 3 && <AdultSVG appearance={appearance} mood={effectiveMood} clothing={clothing} stage={stage} />}
        {stage === 4 && <DeadSVG />}
        {hasDoll && stage >= 2 && (
          <div style={{ position: 'absolute', left: -10, bottom: 22, fontSize: 14, pointerEvents: 'none' }}>🪆</div>
        )}
      </div>
      <style>{KEYFRAMES}</style>
    </div>
  );
}

/** A speech bubble that grows DOWNWARD from a top anchor (tail points down at
 *  the pet below it). Used inside the environment where vertical overflow is
 *  clipped, so we keep the bubble inside the panel. */
function BubbleDown({ text, personalityKey, onDismiss, maxHeight = 100 }) {
  const p = PERSONALITIES[personalityKey] || {};
  const c = p.colors || { bg: '#15151b', text: '#eee', border: '#3338' };
  return (
    <div style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: p.font || 'inherit',
      padding: '6px 26px 6px 12px',                   // extra right padding for the × button
      borderRadius: 12,
      fontSize: 12, lineHeight: 1.35, textAlign: 'left',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word', overflowWrap: 'anywhere',
      maxWidth: '100%',
      maxHeight, overflow: 'hidden', textOverflow: 'ellipsis',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', position: 'relative',
      pointerEvents: 'auto',
    }}>
      {text}
      {onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          title="dismiss"
          style={{
            position: 'absolute', top: 2, right: 4,
            background: 'transparent', border: 'none', color: c.text || '#aaa',
            cursor: 'pointer', padding: '0 4px', fontSize: 12, lineHeight: 1, opacity: 0.6,
          }}
        >×</button>
      )}
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `8px solid ${c.bg}`,
      }} />
    </div>
  );
}

const MOOD_ANIM = {
  idle:     'cgFloat 3s ease-in-out infinite',
  thinking: 'cgWobble 0.8s ease-in-out infinite',
  happy:    'cgBounce 0.5s ease-in-out 3',
  eating:   'cgMunch 0.4s ease-in-out 4',
  shower:   'cgShake 0.15s ease-in-out 8',
  sleeping: 'cgSleep 4s ease-in-out infinite',
  dead:     'none',
  play:     'cgBounce 0.4s ease-in-out infinite',
};

const KEYFRAMES = `
@keyframes cgFloat   { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) translateY(0)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) translateY(-3px)} }
@keyframes cgWobble  { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) rotate(-3deg)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) rotate(3deg)} }
@keyframes cgBounce  { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) translateY(0)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) translateY(-10px)} }
@keyframes cgMunch   { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) scaleY(1)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) scaleY(0.92)} }
@keyframes cgShake   { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) translateX(-2px)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) translateX(2px)} }
@keyframes cgSnooze  { 0%,100%{transform:translateX(-50%) scaleX(var(--dir,1)) scale(1)} 50%{transform:translateX(-50%) scaleX(var(--dir,1)) scale(1.04)} }
/* Sleeping pose: pet lies on its side, curls smaller, breathes gently.
   Offset up-right so the body lands on the bed instead of off the corner. */
@keyframes cgSleep   {
  0%,100% { transform: translateX(-50%) translate(22px, -22px) scaleX(var(--dir,1)) rotate(-55deg) scale(0.72); }
  50%     { transform: translateX(-50%) translate(22px, -24px) scaleX(var(--dir,1)) rotate(-55deg) scale(0.74); }
}
@keyframes cgWiggle  { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
@keyframes cgZzzBig   { 0%{transform:translateX(-50%) translateY(0) scale(.9); opacity:.5} 50%{transform:translateX(-50%) translateY(-8px) scale(1.1); opacity:1} 100%{transform:translateX(-50%) translateY(-16px) scale(.9); opacity:0} }
@keyframes cgZzzSmall { 0%{transform:translateX(-50%) translateY(0); opacity:.3} 50%{opacity:.6} 100%{transform:translateX(-50%) translateY(-10px); opacity:0} }
`;

// ── SVG forms ────────────────────────────────────────────────────────────────

function EggSVG({ appearance, evolutionScore }) {
  const egg = appearance?.egg || { baseColor: { css: '#dcd0c0' }, speckleColor: { css: '#aaa' }, pattern: 'dots', patternDensity: 0.4, crackStages: [] };
  // Progressive cracks: stage 1 at ~30%, stage 2 at ~60%, stage 3 at ~85%.
  // evolutionScore is bounded by thresholds; assume 200 as a normalizer.
  const pct = Math.min(1, (evolutionScore || 0) / 200);
  const stages = [
    pct > 0.30 ? egg.crackStages?.[0] : null,
    pct > 0.60 ? egg.crackStages?.[1] : null,
    pct > 0.85 ? egg.crackStages?.[2] : null,
  ].filter(Boolean);
  // Subtle pre-hatch wobble intensifies as we approach the threshold.
  const wobbleSpeed = pct > 0.85 ? '0.7s' : pct > 0.5 ? '1.2s' : '2s';
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" style={{ animation: `cgWiggle ${wobbleSpeed} ease-in-out infinite` }}>
      <defs>
        <radialGradient id="eggGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor={egg.baseColor.css} />
        </radialGradient>
        <clipPath id="eggClip">
          <ellipse cx="30" cy="48" rx="24" ry="30" />
        </clipPath>
      </defs>
      <ellipse cx="30" cy="48" rx="24" ry="30" fill="url(#eggGrad)" stroke="#0006" strokeWidth="0.5" />
      {/* Patterns clipped inside the egg outline so they can never escape. */}
      <g clipPath="url(#eggClip)">
        {egg.pattern === 'dots' && Array.from({ length: 8 }).map((_, i) => (
          <circle key={i} cx={15 + (i % 4) * 10} cy={30 + Math.floor(i / 4) * 18} r={1.5 + (i % 2)} fill={egg.speckleColor.css} opacity={egg.patternDensity} />
        ))}
        {egg.pattern === 'stripes' && Array.from({ length: 4 }).map((_, i) => (
          <ellipse key={i} cx="30" cy={28 + i * 10} rx="22" ry="1.5" fill={egg.speckleColor.css} opacity={egg.patternDensity} />
        ))}
        {egg.pattern === 'blotches' && Array.from({ length: 5 }).map((_, i) => (
          <ellipse key={i} cx={18 + (i * 7) % 25} cy={28 + i * 8} rx="4" ry="3" fill={egg.speckleColor.css} opacity={egg.patternDensity * 0.7} />
        ))}
        {/* Progressive cracks — also clipped inside the shell. */}
        {stages.map((d, i) => (
          <path key={i} d={d} stroke="#0009" strokeWidth={0.7 + i * 0.3} fill="none" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}

/** Build a closed quadratic blob path from polar anchors (Ditto-like). */
function blobPath(anchors, bumpAt = -1, cx = 35, cy = 55, baseRadius = 24) {
  if (!Array.isArray(anchors) || anchors.length < 4) {
    return `M ${cx - baseRadius} ${cy} a ${baseRadius} ${baseRadius * 0.85} 0 1 0 ${baseRadius * 2} 0 a ${baseRadius} ${baseRadius * 0.85} 0 1 0 ${-baseRadius * 2} 0 z`;
  }
  const pts = anchors.map((a, i) => {
    const r = baseRadius * a.radius * (i === bumpAt ? 1.18 : 1);
    return {
      x: cx + Math.cos(a.angle) * r,
      y: cy + Math.sin(a.angle) * r * 0.88,
    };
  });
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const cur  = pts[i];
    const next = pts[(i + 1) % pts.length];
    const mid  = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
    d += ` Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`;
  }
  return d + ' Z';
}

function HatchlingSVG({ appearance, mood, clothing }) {
  const h = appearance?.hatchling || { blobColor: { css: '#cc9' }, eyeColor: { css: '#222' }, anchors: [], bumpAt: -1 };
  const eyeY = mood === 'sleeping' ? 38 : 36;
  const pathD = blobPath(h.anchors, h.bumpAt ?? -1, 35, 55, 24);
  return (
    <svg width="70" height="80" viewBox="0 0 70 80">
      <defs>
        <radialGradient id="hatchBody" cx="40%" cy="35%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor={h.blobColor.css} />
        </radialGradient>
      </defs>
      <path d={pathD} fill="url(#hatchBody)" stroke="#0004" strokeWidth="0.5" />
      {h.cheekColor?.css && (
        <>
          <ellipse cx="24" cy="46" rx="3.5" ry="2" fill={h.cheekColor.css} opacity="0.55" />
          <ellipse cx="46" cy="46" rx="3.5" ry="2" fill={h.cheekColor.css} opacity="0.55" />
        </>
      )}
      {mood === 'sleeping' ? (
        <>
          <path d="M 24 38 Q 28 36 32 38" stroke={h.eyeColor.css} strokeWidth="2" fill="none" />
          <path d="M 38 38 Q 42 36 46 38" stroke={h.eyeColor.css} strokeWidth="2" fill="none" />
        </>
      ) : (
        <>
          <circle cx="28" cy={eyeY} r="3" fill={h.eyeColor.css} />
          <circle cx="42" cy={eyeY} r="3" fill={h.eyeColor.css} />
          <circle cx="29" cy={eyeY - 1} r="0.8" fill="white" />
          <circle cx="43" cy={eyeY - 1} r="0.8" fill="white" />
        </>
      )}
      <path d="M 30 50 Q 35 53 40 50" stroke="#0007" strokeWidth="1" fill="none" />
      {/* Hatchling can wear head items only */}
      <ClothingLayer clothing={clothing} stage={1} />
    </svg>
  );
}

function bodyPath(shape) {
  switch (shape) {
    case 'chunky': return 'M 15 70 Q 10 35 35 30 Q 60 35 55 70 Q 35 78 15 70 Z';
    case 'slim':   return 'M 25 70 Q 18 32 35 28 Q 52 32 45 70 Q 35 75 25 70 Z';
    case 'wide':   return 'M 10 70 Q 8 38 35 32 Q 62 38 60 70 Q 35 80 10 70 Z';
    case 'petite': return 'M 24 70 Q 20 38 35 34 Q 50 38 46 70 Q 35 74 24 70 Z';
    case 'round':
    default:       return 'M 18 70 Q 12 34 35 30 Q 58 34 52 70 Q 35 78 18 70 Z';
  }
}

/** Half-width of the face area, per body shape — used so eyes/cheeks
 *  shift to track the body silhouette instead of being centered statically. */
function faceWidthFor(shape) {
  switch (shape) {
    case 'wide':   return 14;
    case 'chunky': return 12;
    case 'round':  return 11;
    case 'slim':   return 9;
    case 'petite': return 10;
    default:       return 11;
  }
}

function earSvg(type, color, scale = 1) {
  if (type === 'none') return null;
  const s = scale;
  if (type === 'round')   return <><circle cx="20" cy="28" r={6 * s} fill={color} /><circle cx="50" cy="28" r={6 * s} fill={color} /></>;
  if (type === 'pointy')  return <><polygon points={`16,30 22,${30 - 14 * s} 26,30`} fill={color} /><polygon points={`44,30 48,${30 - 14 * s} 54,30`} fill={color} /></>;
  if (type === 'floppy')  return <><ellipse cx="20" cy={34 + 4 * s} rx="5" ry={9 * s} fill={color} /><ellipse cx="50" cy={34 + 4 * s} rx="5" ry={9 * s} fill={color} /></>;
  if (type === 'tufted')  return (
    <>
      <polygon points={`18,30 22,${30 - 10 * s} 26,30`} fill={color} />
      <polygon points={`44,30 48,${30 - 10 * s} 54,30`} fill={color} />
      {/* fluffy tuft balls at tips */}
      <circle cx="22" cy={30 - 10 * s} r={2 * s} fill={color} />
      <circle cx="48" cy={30 - 10 * s} r={2 * s} fill={color} />
    </>
  );
  return null;
}

function tailSvg(type, color) {
  if (!type || type === 'none') return null;
  if (type === 'stubby') return <ellipse cx="58" cy="62" rx="5" ry="4" fill={color} />;
  if (type === 'long')   return <path d="M 56 62 Q 70 55 72 42" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />;
  if (type === 'curly')  return <path d="M 56 62 Q 68 62 66 52 Q 64 46 70 46" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />;
  if (type === 'puff')   return (
    <>
      <circle cx="60" cy="58" r="5" fill={color} />
      <circle cx="64" cy="54" r="3.5" fill={color} opacity="0.95" />
      <circle cx="62" cy="62" r="3" fill={color} opacity="0.85" />
    </>
  );
  return null;
}

/** Eye sprite — positions shift with bodyShape's face width so wide bodies
 *  get wider-set eyes and slim bodies get tighter eyes. */
function eyeSvg(shape, color, mood, faceWidth = 11) {
  const cxL = 35 - faceWidth;
  const cxR = 35 + faceWidth;
  if (mood === 'sleeping' || shape === 'sleepy') {
    return (
      <>
        <path d={`M ${cxL - 4} 42 Q ${cxL} 40 ${cxL + 4} 42`} stroke={color} strokeWidth="2" fill="none" />
        <path d={`M ${cxR - 4} 42 Q ${cxR} 40 ${cxR + 4} 42`} stroke={color} strokeWidth="2" fill="none" />
      </>
    );
  }
  const ry = shape === 'almond' ? 2 : shape === 'wide' ? 4 : 3;
  const rx = shape === 'almond' ? 3.5 : shape === 'wide' ? 3.5 : 3;
  return (
    <>
      <ellipse cx={cxL} cy="43" rx={rx} ry={ry} fill={color} />
      <ellipse cx={cxR} cy="43" rx={rx} ry={ry} fill={color} />
      <circle cx={cxL + 1} cy="42" r="0.9" fill="white" />
      <circle cx={cxR + 1} cy="42" r="0.9" fill="white" />
    </>
  );
}

function mouthSvg(mood, faceWidth = 11) {
  const half = Math.max(4, Math.min(8, faceWidth - 4));
  if (mood === 'happy' || mood === 'play') return <path d={`M ${35 - half} 52 Q 35 ${52 + half - 1} ${35 + half} 52`} stroke="#0009" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  if (mood === 'eating') return <ellipse cx="35" cy="54" rx="5" ry="3" fill="#3a1f1f" />;
  if (mood === 'dead')   return <line x1={35 - half} y1="54" x2={35 + half} y2="54" stroke="#0009" strokeWidth="1.5" />;
  return <path d={`M ${35 - half + 1} 53 Q 35 55 ${35 + half - 1} 53`} stroke="#0008" strokeWidth="1.2" fill="none" />;
}

function AdolescentSVG({ appearance, mood, clothing, stage }) {
  const a = appearance?.adolescent;
  if (!a) return null;
  // A genuine transitional form between the hatchling blob and the full adult:
  // - Rounder, taller-than-wide body (still pudgy, hints of standing)
  // - Proto-ears (small, soft, starting to take adult shape)
  // - Stubby starter tail
  // - Tiny limb nubs (feet visible at the base, no proper arms yet)
  // - Larger, cuter eyes (still very baby-like)
  const earCol  = a.primaryColor.css;
  const bodyCol = a.primaryColor.css;
  const accent  = a.accentColor?.css || bodyCol;
  const cheekCol= a.cheekColor?.css || '#fff8';
  return (
    <svg width="80" height="92" viewBox="0 0 70 80">
      {/* Stubby starter tail (always present, gives a hint of the future tail) */}
      <ellipse cx="60" cy="62" rx="4" ry="3" fill={accent} opacity="0.85" />

      {/* Soft proto-ears — adult shape but ~60% size with rounded tips */}
      {a.earType === 'pointy'  && (
        <g><path d="M 18 28 Q 21 16 26 26 Z" fill={earCol} /><path d="M 52 28 Q 49 16 44 26 Z" fill={earCol} /></g>
      )}
      {a.earType === 'floppy'  && (
        <g><ellipse cx="20" cy="32" rx="4" ry="7" fill={earCol} /><ellipse cx="50" cy="32" rx="4" ry="7" fill={earCol} /></g>
      )}
      {(a.earType === 'round' || !a.earType) && (
        <g><circle cx="22" cy="26" r="4.5" fill={earCol} /><circle cx="48" cy="26" r="4.5" fill={earCol} /></g>
      )}

      {/* Body — bulbous pear shape, narrower at top, wider at base */}
      <path d="M 22 32 Q 14 42 16 62 Q 18 74 35 76 Q 52 74 54 62 Q 56 42 48 32 Q 35 28 22 32 Z"
            fill={bodyCol} stroke="#0005" strokeWidth="0.6" />

      {/* Belly highlight — lighter blob in the middle */}
      <ellipse cx="35" cy="58" rx="11" ry="9" fill={a.highlightColor?.css || '#fff'} opacity="0.25" />

      {/* Tiny foot nubs starting to poke out at the base */}
      <ellipse cx="28" cy="76" rx="4" ry="2" fill={bodyCol} />
      <ellipse cx="42" cy="76" rx="4" ry="2" fill={bodyCol} />

      {/* Rosy cheeks — bigger and rounder than adult (more baby-like) */}
      <ellipse cx="22" cy="50" rx="5" ry="3" fill={cheekCol} opacity="0.7" />
      <ellipse cx="48" cy="50" rx="5" ry="3" fill={cheekCol} opacity="0.7" />

      {/* Eyes — slightly larger than adult for a younger look */}
      {mood === 'sleeping' || a.eyeShape === 'sleepy'
        ? (
          <>
            <path d="M 22 43 Q 26 41 30 43" stroke={a.eyeColor.css} strokeWidth="2.2" fill="none" />
            <path d="M 40 43 Q 44 41 48 43" stroke={a.eyeColor.css} strokeWidth="2.2" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx="26" cy="44" rx="3.6" ry="4" fill={a.eyeColor.css} />
            <ellipse cx="44" cy="44" rx="3.6" ry="4" fill={a.eyeColor.css} />
            <circle cx="27.2" cy="42.8" r="1.1" fill="white" />
            <circle cx="45.2" cy="42.8" r="1.1" fill="white" />
          </>
        )}

      {/* Smaller, simpler mouth */}
      {mood === 'happy' || mood === 'play'
        ? <path d="M 30 55 Q 35 60 40 55" stroke="#0009" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        : mood === 'eating'
          ? <ellipse cx="35" cy="56" rx="4" ry="2.5" fill="#3a1f1f" />
          : <path d="M 32 55 Q 35 57 38 55" stroke="#0008" strokeWidth="1.2" fill="none" />}

      <ClothingLayer clothing={clothing} stage={stage ?? 2} />
    </svg>
  );
}

function AdultSVG({ appearance, mood, clothing, stage }) {
  const a = appearance?.adult;
  if (!a) return null;
  const fw = faceWidthFor(a.bodyShape);
  const cheekL = 35 - (fw + 2);
  const cheekR = 35 + (fw + 2);
  return (
    <svg width="90" height="100" viewBox="0 0 70 80">
      {tailSvg(a.tailType, a.accentColor.css)}
      {earSvg(a.earType, a.primaryColor.css, 1)}
      <path d={bodyPath(a.bodyShape)} fill={a.primaryColor.css} stroke="#0005" strokeWidth="0.6" />
      <ellipse cx="35" cy="58" rx="14" ry="10" fill={a.highlightColor?.css || '#fff5'} opacity="0.35" />
      <ellipse cx={cheekL} cy="50" rx="5" ry="3" fill={a.cheekColor.css} opacity="0.7" />
      <ellipse cx={cheekR} cy="50" rx="5" ry="3" fill={a.cheekColor.css} opacity="0.7" />
      {eyeSvg(a.eyeShape, a.eyeColor.css, mood, fw)}
      {mouthSvg(mood, fw)}
      <ClothingLayer clothing={clothing} stage={stage ?? 3} />
    </svg>
  );
}

/**
 * ClothingLayer (Phase 8): canonical slots are head|body|arms|feet.
 * Stage gating: egg=none, hatchling=head only, adolescent+=all four.
 *
 * ─── ITEM ID → RENDER FN MAP (for editing) ──────────────────────────────
 *   Head:  renderHead()  → top_hat, bowler_hat, baseball_cap, party_hat,
 *                           crown, wizard_hat, halo, space_helmet,
 *                           antenna_headband, sunglasses, mustache,
 *                           halloween_mask, wolf_mask
 *   Body:  renderBody()  → plain_tee, tie_dye_shirt, scarf, dev_hoodie,
 *                           formal_vest, cape, tuxedo_top, lab_coat,
 *                           pirate_vest, royal_robe, jetpack
 *   Arms:  renderArms()  → mittens, bracelets, gloves, wrist_watch,
 *                           boxing_gloves, gauntlets
 *   Feet:  renderFeet()  → socks, sneakers, rain_boots, ankle_monitor,
 *                           formal_shoes, winged_sandals
 *
 * To edit/replace an item's look: open the switch in the matching function
 * below and swap the SVG. Item DEFINITIONS (cost, rarity, etc) live in
 * app/src/shop/ShopItems.js — both files are plain JS, edit freely.
 * ───────────────────────────────────────────────────────────────────────────
 */
const STAGE_SLOTS_ALLOWED = {
  0: new Set(),
  1: new Set(['head']),
  2: new Set(['head', 'body', 'arms', 'feet']),
  3: new Set(['head', 'body', 'arms', 'feet']),
  4: new Set(),
};

function ClothingLayer({ clothing, stage = 3 }) {
  if (!clothing?.length) return null;
  const allowed = STAGE_SLOTS_ALLOWED[stage] || new Set();
  return (
    <>
      {clothing.map((c, i) => {
        const slot = c.slot;
        if (!slot || !allowed.has(slot)) return null;
        if (slot === 'head')  return <g key={i}>{renderHead(c)}</g>;
        if (slot === 'body')  return <g key={i}>{renderBody(c)}</g>;
        if (slot === 'arms')  return <g key={i}>{renderArms(c)}</g>;
        if (slot === 'feet')  return <g key={i}>{renderFeet(c)}</g>;
        return null;
      })}
    </>
  );
}

function renderHead(c) {
  switch (c.id) {
    case 'top_hat':          return <><rect x="24" y="14" width="22" height="14" fill="#111" /><rect x="20" y="26" width="30" height="3" fill="#111" /></>;
    case 'bowler_hat':       return <><ellipse cx="35" cy="22" rx="14" ry="8" fill="#2c1810" /><rect x="20" y="24" width="30" height="3" fill="#2c1810" /></>;
    case 'baseball_cap':     return <><ellipse cx="35" cy="22" rx="13" ry="7" fill="#c0392b" /><rect x="35" y="22" width="14" height="3" fill="#c0392b" /></>;
    case 'party_hat':        return <><polygon points="28,26 35,8 42,26" fill="#e74c3c" /><circle cx="35" cy="8" r="2" fill="#ffd700" /></>;
    case 'crown':            return <polygon points="22,22 26,12 30,22 35,10 40,22 44,12 48,22" fill="#ffd700" stroke="#a87a00" />;
    case 'wizard_hat':       return <><polygon points="20,26 35,2 50,26" fill="#3a3a8a" /><circle cx="35" cy="6" r="2" fill="#ffd700" /></>;
    case 'halo':             return <><ellipse cx="35" cy="14" rx="14" ry="3" fill="none" stroke="#ffd700" strokeWidth="2" /></>;
    case 'space_helmet':     return (
      <>
        {/* Glass dome — full sphere outline, low opacity so eyes show through */}
        <circle cx="35" cy="40" r="22" fill="#cce6ff" opacity="0.15" stroke="#aaa" strokeWidth="1.2" />
        {/* Metal ring at base of dome */}
        <ellipse cx="35" cy="58" rx="22" ry="3" fill="#7f8c8d" />
        {/* Visor glint */}
        <path d="M 18 32 Q 26 22 36 22" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.6" />
      </>
    );
    case 'antenna_headband': return <><rect x="20" y="26" width="30" height="3" fill="#333" /><line x1="28" y1="26" x2="26" y2="14" stroke="#333" /><circle cx="26" cy="13" r="2" fill="#e74c3c" /><line x1="42" y1="26" x2="44" y2="14" stroke="#333" /><circle cx="44" cy="13" r="2" fill="#3498db" /></>;
    case 'sunglasses':       return <><rect x="20" y="40" width="30" height="6" fill="#111" /><circle cx="26" cy="43" r="4" fill="#111" /><circle cx="44" cy="43" r="4" fill="#111" /></>;
    case 'mustache':         return (
      <>
        {/* Handlebar mustache: curled tips that rise outward */}
        <path d="M 22 53 Q 26 49 30 52 Q 33 54 35 53 Q 37 54 40 52 Q 44 49 48 53 Q 46 51 43 52 Q 39 54 35 54 Q 31 54 27 52 Q 24 51 22 53 Z"
              fill="#3b2618" stroke="#1a0f08" strokeWidth="0.4" />
        {/* Curled tip whiskers */}
        <path d="M 22 53 Q 19 51 20 49" stroke="#3b2618" strokeWidth="1.2" fill="none" />
        <path d="M 48 53 Q 51 51 50 49" stroke="#3b2618" strokeWidth="1.2" fill="none" />
      </>
    );
    case 'halloween_mask':   return <><circle cx="35" cy="42" r="15" fill="#ff8c00" /><polygon points="29,40 33,40 31,44" fill="#000" /><polygon points="37,40 41,40 39,44" fill="#000" /><path d="M 28 50 L 32 48 L 35 50 L 38 48 L 42 50" stroke="#000" strokeWidth="1.5" fill="none" /></>;
    case 'wolf_mask':        return <><polygon points="22,28 28,12 32,24" fill="#555" /><polygon points="38,24 42,12 48,28" fill="#555" /><circle cx="35" cy="42" r="14" fill="#3a3a3a" opacity="0.8" /></>;
    default:                 return null;
  }
}

function renderBody(c) {
  switch (c.id) {
    case 'plain_tee':     return <path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="#3498db" opacity="0.9" />;
    case 'tie_dye_shirt': return <path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="url(#tieDye)" opacity="0.9" />;
    case 'scarf':         return (
      <>
        {/* Wrapped neck loop with hanging tail */}
        <path d="M 18 56 Q 18 62 22 64 L 48 64 Q 52 62 52 56 Q 52 60 48 61 L 22 61 Q 18 60 18 56 Z"
              fill="#c0392b" stroke="#7a1d10" strokeWidth="0.5" />
        {/* Hanging tail draped down the front */}
        <path d="M 40 62 L 44 76 L 38 76 L 36 62 Z" fill="#c0392b" stroke="#7a1d10" strokeWidth="0.5" />
        {/* Fringe */}
        <line x1="37" y1="76" x2="37" y2="78" stroke="#7a1d10" strokeWidth="0.8" />
        <line x1="40" y1="76" x2="40" y2="78" stroke="#7a1d10" strokeWidth="0.8" />
        <line x1="43" y1="76" x2="43" y2="78" stroke="#7a1d10" strokeWidth="0.8" />
      </>
    );
    case 'dev_hoodie':    return <path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="#2c3e50" opacity="0.9" />;
    case 'formal_vest':   return <path d="M 18 56 L 35 60 L 52 56 L 50 74 L 20 74 Z" fill="#1a1a1a" opacity="0.9" />;
    case 'cape':          return <path d="M 14 32 Q 8 60 18 72 L 52 72 Q 62 60 56 32 Z" fill="#7d3c98" opacity="0.85" />;
    case 'tuxedo_top':    return <><path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="#000" /><path d="M 30 56 L 35 70 L 40 56 Z" fill="#fff" /></>;
    case 'lab_coat':      return <path d="M 14 56 Q 14 74 35 76 Q 56 74 56 56 Z" fill="#fff" opacity="0.9" />;
    case 'pirate_vest':   return <><path d="M 16 56 Q 16 72 35 74 Q 54 72 54 56 Z" fill="#5d2906" /><line x1="30" y1="58" x2="40" y2="72" stroke="#000" strokeWidth="1" /></>;
    case 'royal_robe':    return <path d="M 12 50 Q 8 75 35 76 Q 62 75 58 50 Z" fill="#8e44ad" opacity="0.9" />;
    case 'jetpack':       return <><rect x="10" y="46" width="6" height="22" fill="#888" /><rect x="54" y="46" width="6" height="22" fill="#888" /><polygon points="10,68 16,68 13,76" fill="#f39c12" /><polygon points="54,68 60,68 57,76" fill="#f39c12" /></>;
    default:              return null;
  }
}

function renderArms(c) {
  // Each arm item gets its own left + right SVG group. Anchor points are
  // (~13,60) for the left "hand" and (~57,60) for the right (mirrored).
  switch (c.id) {
    case 'mittens': {
      // Rounded blob + thumb stub on each side
      return (
        <>
          <g>
            <ellipse cx="13" cy="62" rx="4.5" ry="5.5" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <circle cx="9" cy="61" r="2" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <line x1="10" y1="64" x2="16" y2="64" stroke="#7a1d10" strokeWidth="0.5" />
          </g>
          <g>
            <ellipse cx="57" cy="62" rx="4.5" ry="5.5" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <circle cx="61" cy="61" r="2" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <line x1="54" y1="64" x2="60" y2="64" stroke="#7a1d10" strokeWidth="0.5" />
          </g>
        </>
      );
    }
    case 'gloves': {
      // Five-finger glove silhouette with knuckle lines
      return (
        <>
          <g>
            <path d="M 9 64 L 9 60 L 11 58 L 13 58 L 15 58 L 17 60 L 17 65 Q 13 68 9 64 Z" fill="#fff" stroke="#888" strokeWidth="0.4" />
            <line x1="11" y1="60" x2="11" y2="63" stroke="#aaa" strokeWidth="0.3" />
            <line x1="13" y1="60" x2="13" y2="63" stroke="#aaa" strokeWidth="0.3" />
            <line x1="15" y1="60" x2="15" y2="63" stroke="#aaa" strokeWidth="0.3" />
          </g>
          <g>
            <path d="M 53 64 L 53 60 L 55 58 L 57 58 L 59 58 L 61 60 L 61 65 Q 57 68 53 64 Z" fill="#fff" stroke="#888" strokeWidth="0.4" />
            <line x1="55" y1="60" x2="55" y2="63" stroke="#aaa" strokeWidth="0.3" />
            <line x1="57" y1="60" x2="57" y2="63" stroke="#aaa" strokeWidth="0.3" />
            <line x1="59" y1="60" x2="59" y2="63" stroke="#aaa" strokeWidth="0.3" />
          </g>
        </>
      );
    }
    case 'wrist_watch': {
      // Strap + face circle on right wrist only (traditional)
      return (
        <>
          <rect x="55" y="58" width="6" height="5" rx="1" fill="#1a1a1a" />
          <circle cx="58" cy="60.5" r="2.5" fill="#ddd" stroke="#666" strokeWidth="0.3" />
          <line x1="58" y1="60.5" x2="58" y2="59" stroke="#000" strokeWidth="0.4" />
          <line x1="58" y1="60.5" x2="59.5" y2="61" stroke="#000" strokeWidth="0.4" />
        </>
      );
    }
    case 'boxing_gloves': {
      // Oversized rounded fists with seam line
      return (
        <>
          <g>
            <ellipse cx="11" cy="63" rx="6.5" ry="7" fill="#c0392b" stroke="#5a1a0a" strokeWidth="0.6" />
            <path d="M 8 63 Q 11 60 14 63" stroke="#5a1a0a" strokeWidth="0.6" fill="none" />
            <ellipse cx="11" cy="60" rx="1.5" ry="1" fill="#fff" opacity="0.4" />
          </g>
          <g>
            <ellipse cx="59" cy="63" rx="6.5" ry="7" fill="#c0392b" stroke="#5a1a0a" strokeWidth="0.6" />
            <path d="M 56 63 Q 59 60 62 63" stroke="#5a1a0a" strokeWidth="0.6" fill="none" />
            <ellipse cx="59" cy="60" rx="1.5" ry="1" fill="#fff" opacity="0.4" />
          </g>
        </>
      );
    }
    case 'bracelets': {
      // Small loop rings on both wrists
      return (
        <>
          <ellipse cx="13" cy="60" rx="3" ry="1.2" fill="none" stroke="#f1c40f" strokeWidth="1.2" />
          <ellipse cx="13" cy="62" rx="3" ry="1.2" fill="none" stroke="#e67e22" strokeWidth="1" />
          <ellipse cx="57" cy="60" rx="3" ry="1.2" fill="none" stroke="#f1c40f" strokeWidth="1.2" />
          <ellipse cx="57" cy="62" rx="3" ry="1.2" fill="none" stroke="#e67e22" strokeWidth="1" />
        </>
      );
    }
    case 'gauntlets': {
      // Layered armor plates with rivets
      return (
        <>
          <g>
            <rect x="8" y="56" width="10" height="3.5" rx="0.5" fill="#7f8c8d" stroke="#34495e" strokeWidth="0.3" />
            <rect x="8" y="60" width="10" height="3.5" rx="0.5" fill="#95a5a6" stroke="#34495e" strokeWidth="0.3" />
            <rect x="8" y="64" width="10" height="3.5" rx="0.5" fill="#7f8c8d" stroke="#34495e" strokeWidth="0.3" />
            <circle cx="10" cy="57.5" r="0.5" fill="#222" />
            <circle cx="16" cy="57.5" r="0.5" fill="#222" />
          </g>
          <g>
            <rect x="52" y="56" width="10" height="3.5" rx="0.5" fill="#7f8c8d" stroke="#34495e" strokeWidth="0.3" />
            <rect x="52" y="60" width="10" height="3.5" rx="0.5" fill="#95a5a6" stroke="#34495e" strokeWidth="0.3" />
            <rect x="52" y="64" width="10" height="3.5" rx="0.5" fill="#7f8c8d" stroke="#34495e" strokeWidth="0.3" />
            <circle cx="54" cy="57.5" r="0.5" fill="#222" />
            <circle cx="60" cy="57.5" r="0.5" fill="#222" />
          </g>
        </>
      );
    }
    default:
      return null;
  }
}

function renderFeet(c) {
  switch (c.id) {
    case 'socks':
      // Striped tube socks rising up the ankle
      return (
        <>
          <g>
            <rect x="20" y="68" width="8" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.3" />
            <line x1="20" y1="70" x2="28" y2="70" stroke="#e74c3c" strokeWidth="0.6" />
            <line x1="20" y1="72" x2="28" y2="72" stroke="#3498db" strokeWidth="0.6" />
            <ellipse cx="24" cy="74" rx="4.5" ry="2" fill="#fff" stroke="#ccc" strokeWidth="0.3" />
          </g>
          <g>
            <rect x="42" y="68" width="8" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.3" />
            <line x1="42" y1="70" x2="50" y2="70" stroke="#e74c3c" strokeWidth="0.6" />
            <line x1="42" y1="72" x2="50" y2="72" stroke="#3498db" strokeWidth="0.6" />
            <ellipse cx="46" cy="74" rx="4.5" ry="2" fill="#fff" stroke="#ccc" strokeWidth="0.3" />
          </g>
        </>
      );
    case 'sneakers':
      // Sneaker with sole + toe cap
      return (
        <>
          <g>
            <path d="M 18 73 L 18 70 Q 22 67 28 70 L 30 74 Z" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <rect x="17" y="73" width="14" height="2" rx="1" fill="#fff" stroke="#aaa" strokeWidth="0.3" />
            <line x1="22" y1="70" x2="24" y2="73" stroke="#fff" strokeWidth="0.5" />
          </g>
          <g>
            <path d="M 40 73 L 40 70 Q 44 67 50 70 L 52 74 Z" fill="#e74c3c" stroke="#7a1d10" strokeWidth="0.4" />
            <rect x="39" y="73" width="14" height="2" rx="1" fill="#fff" stroke="#aaa" strokeWidth="0.3" />
            <line x1="44" y1="70" x2="46" y2="73" stroke="#fff" strokeWidth="0.5" />
          </g>
        </>
      );
    case 'rain_boots':
      // Tall calf-height rubber boot
      return (
        <>
          <path d="M 19 64 L 30 64 L 30 72 L 32 76 L 18 76 L 20 72 Z" fill="#3498db" stroke="#1f5a7a" strokeWidth="0.5" />
          <path d="M 41 64 L 52 64 L 52 72 L 54 76 L 40 76 L 42 72 Z" fill="#3498db" stroke="#1f5a7a" strokeWidth="0.5" />
        </>
      );
    case 'ankle_monitor':
      // Black ankle bracelet on one foot with a red blinking dot
      return (
        <>
          <ellipse cx="24" cy="73" rx="6" ry="3" fill="#444" />
          <ellipse cx="46" cy="73" rx="6" ry="3" fill="#444" />
          <rect x="40" y="68" width="12" height="3" rx="1.5" fill="#1a1a1a" stroke="#000" strokeWidth="0.3" />
          <circle cx="46" cy="69.5" r="0.8" fill="#e74c3c">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </>
      );
    case 'formal_shoes':
      // Polished oxford with sheen + heel
      return (
        <>
          <g>
            <path d="M 16 73 Q 16 71 19 70 L 30 70 Q 31 73 30 74 L 16 74 Z" fill="#1a1a1a" stroke="#000" strokeWidth="0.3" />
            <ellipse cx="22" cy="71.5" rx="3" ry="0.6" fill="#fff" opacity="0.25" />
            <rect x="27" y="74" width="3" height="1.5" fill="#000" />
          </g>
          <g>
            <path d="M 38 73 Q 38 71 41 70 L 52 70 Q 53 73 52 74 L 38 74 Z" fill="#1a1a1a" stroke="#000" strokeWidth="0.3" />
            <ellipse cx="44" cy="71.5" rx="3" ry="0.6" fill="#fff" opacity="0.25" />
            <rect x="49" y="74" width="3" height="1.5" fill="#000" />
          </g>
        </>
      );
    case 'winged_sandals':
      // Sandal strap + tiny gold wings sprouting from the heel
      return (
        <>
          <g>
            <ellipse cx="24" cy="73" rx="6" ry="2.5" fill="#f1c40f" />
            <line x1="20" y1="71" x2="28" y2="71" stroke="#a87a00" strokeWidth="0.6" />
            <path d="M 18 71 Q 14 67 12 70 Q 14 71 18 73 Z" fill="#fff" stroke="#aaa" strokeWidth="0.3" />
          </g>
          <g>
            <ellipse cx="46" cy="73" rx="6" ry="2.5" fill="#f1c40f" />
            <line x1="42" y1="71" x2="50" y2="71" stroke="#a87a00" strokeWidth="0.6" />
            <path d="M 52 71 Q 56 67 58 70 Q 56 71 52 73 Z" fill="#fff" stroke="#aaa" strokeWidth="0.3" />
          </g>
        </>
      );
    default:
      return null;
  }
}

function DeadSVG() {
  return (
    <svg width="80" height="80" viewBox="0 0 70 80">
      <ellipse cx="35" cy="60" rx="25" ry="14" fill="#222" opacity="0.7" />
      <text x="35" y="40" textAnchor="middle" fontSize="36">💀</text>
    </svg>
  );
}
