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
          maxWidth: width - 20,
          zIndex: 5,
        }}>
          <BubbleDown text={speech} personalityKey={personalityKey} />
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
function BubbleDown({ text, personalityKey }) {
  const p = PERSONALITIES[personalityKey] || {};
  const c = p.colors || { bg: '#15151b', text: '#eee', border: '#3338' };
  return (
    <div style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: p.font || 'inherit',
      padding: '6px 12px', borderRadius: 12,
      fontSize: 12, lineHeight: 1.35, textAlign: 'center',
      whiteSpace: 'pre-wrap', maxWidth: '100%',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', position: 'relative',
    }}>
      {text}
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
  const egg = appearance?.egg || { baseColor: { css: '#dcd0c0' }, speckleColor: { css: '#aaa' }, pattern: 'dots', patternDensity: 0.4 };
  const cracking = evolutionScore > 50;
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" style={{ animation: 'cgWiggle 2s ease-in-out infinite' }}>
      <defs>
        <radialGradient id="eggGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor={egg.baseColor.css} />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="48" rx="24" ry="30" fill="url(#eggGrad)" stroke="#0006" strokeWidth="0.5" />
      {egg.pattern === 'dots' && Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx={15 + (i % 4) * 10} cy={30 + Math.floor(i / 4) * 18} r={1.5 + (i % 2)} fill={egg.speckleColor.css} opacity={egg.patternDensity} />
      ))}
      {egg.pattern === 'stripes' && Array.from({ length: 4 }).map((_, i) => (
        <ellipse key={i} cx="30" cy={28 + i * 10} rx="22" ry="1.5" fill={egg.speckleColor.css} opacity={egg.patternDensity} />
      ))}
      {egg.pattern === 'blotches' && Array.from({ length: 5 }).map((_, i) => (
        <ellipse key={i} cx={18 + (i * 7) % 25} cy={28 + i * 8} rx="4" ry="3" fill={egg.speckleColor.css} opacity={egg.patternDensity * 0.7} />
      ))}
      {cracking && <path d="M 18 40 L 22 38 L 26 42 L 30 38 L 34 42" stroke="#000" strokeWidth="0.8" fill="none" />}
    </svg>
  );
}

function HatchlingSVG({ appearance, mood, clothing }) {
  const h = appearance?.hatchling || { blobColor: { css: '#cc9' }, eyeColor: { css: '#222' } };
  const eyeY = mood === 'sleeping' ? 38 : 36;
  return (
    <svg width="70" height="80" viewBox="0 0 70 80">
      <defs>
        <radialGradient id="hatchBody" cx="40%" cy="35%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor={h.blobColor.css} />
        </radialGradient>
      </defs>
      <ellipse cx="35" cy="55" rx="28" ry="22" fill="url(#hatchBody)" />
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
    case 'round':
    default:       return 'M 18 70 Q 12 34 35 30 Q 58 34 52 70 Q 35 78 18 70 Z';
  }
}

function earSvg(type, color, scale = 1) {
  if (type === 'none') return null;
  const s = scale;
  if (type === 'round')   return <><circle cx="20" cy="28" r={6 * s} fill={color} /><circle cx="50" cy="28" r={6 * s} fill={color} /></>;
  if (type === 'pointy')  return <><polygon points={`16,30 22,${30 - 14 * s} 26,30`} fill={color} /><polygon points={`44,30 48,${30 - 14 * s} 54,30`} fill={color} /></>;
  if (type === 'floppy')  return <><ellipse cx="20" cy={34 + 4 * s} rx="5" ry={9 * s} fill={color} /><ellipse cx="50" cy={34 + 4 * s} rx="5" ry={9 * s} fill={color} /></>;
  return null;
}

function tailSvg(type, color) {
  if (!type || type === 'none') return null;
  if (type === 'stubby') return <ellipse cx="58" cy="62" rx="5" ry="4" fill={color} />;
  if (type === 'long')   return <path d="M 56 62 Q 70 55 72 42" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />;
  if (type === 'curly')  return <path d="M 56 62 Q 68 62 66 52 Q 64 46 70 46" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />;
  return null;
}

function eyeSvg(shape, color, mood) {
  if (mood === 'sleeping' || shape === 'sleepy') {
    return (
      <>
        <path d="M 22 42 Q 26 40 30 42" stroke={color} strokeWidth="2" fill="none" />
        <path d="M 40 42 Q 44 40 48 42" stroke={color} strokeWidth="2" fill="none" />
      </>
    );
  }
  const ry = shape === 'almond' ? 2 : shape === 'wide' ? 4 : 3;
  const rx = shape === 'almond' ? 3.5 : shape === 'wide' ? 3.5 : 3;
  return (
    <>
      <ellipse cx="26" cy="43" rx={rx} ry={ry} fill={color} />
      <ellipse cx="44" cy="43" rx={rx} ry={ry} fill={color} />
      <circle cx="27" cy="42" r="0.9" fill="white" />
      <circle cx="45" cy="42" r="0.9" fill="white" />
    </>
  );
}

function mouthSvg(mood) {
  if (mood === 'happy' || mood === 'play') return <path d="M 28 52 Q 35 58 42 52" stroke="#0009" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  if (mood === 'eating') return <ellipse cx="35" cy="54" rx="5" ry="3" fill="#3a1f1f" />;
  if (mood === 'dead')   return <line x1="30" y1="54" x2="40" y2="54" stroke="#0009" strokeWidth="1.5" />;
  return <path d="M 31 53 Q 35 55 39 53" stroke="#0008" strokeWidth="1.2" fill="none" />;
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
  return (
    <svg width="90" height="100" viewBox="0 0 70 80">
      {tailSvg(a.tailType, a.accentColor.css)}
      {earSvg(a.earType, a.primaryColor.css, 1)}
      <path d={bodyPath(a.bodyShape)} fill={a.primaryColor.css} stroke="#0005" strokeWidth="0.6" />
      <ellipse cx="35" cy="58" rx="14" ry="10" fill={a.highlightColor?.css || '#fff5'} opacity="0.35" />
      <ellipse cx="22" cy="50" rx="5" ry="3" fill={a.cheekColor.css} opacity="0.7" />
      <ellipse cx="48" cy="50" rx="5" ry="3" fill={a.cheekColor.css} opacity="0.7" />
      {eyeSvg(a.eyeShape, a.eyeColor.css, mood)}
      {mouthSvg(mood)}
      <ClothingLayer clothing={clothing} stage={stage ?? 3} />
    </svg>
  );
}

/**
 * ClothingLayer (Phase 8): canonical slots are head|body|arms|feet.
 * Stage gating: egg=none, hatchling=head only, adolescent+=all four.
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
    case 'space_helmet':     return <><circle cx="35" cy="38" r="20" fill="none" stroke="#aaa" strokeWidth="1" opacity="0.6" /><ellipse cx="35" cy="22" rx="18" ry="5" fill="#bbb" opacity="0.5" /></>;
    case 'antenna_headband': return <><rect x="20" y="26" width="30" height="3" fill="#333" /><line x1="28" y1="26" x2="26" y2="14" stroke="#333" /><circle cx="26" cy="13" r="2" fill="#e74c3c" /><line x1="42" y1="26" x2="44" y2="14" stroke="#333" /><circle cx="44" cy="13" r="2" fill="#3498db" /></>;
    case 'sunglasses':       return <><rect x="20" y="40" width="30" height="6" fill="#111" /><circle cx="26" cy="43" r="4" fill="#111" /><circle cx="44" cy="43" r="4" fill="#111" /></>;
    case 'mustache':         return <path d="M 27 52 Q 30 49 35 51 Q 40 49 43 52 Q 39 54 35 53 Q 31 54 27 52 Z" fill="#3b2618" />;
    case 'halloween_mask':   return <><circle cx="35" cy="42" r="15" fill="#ff8c00" /><polygon points="29,40 33,40 31,44" fill="#000" /><polygon points="37,40 41,40 39,44" fill="#000" /><path d="M 28 50 L 32 48 L 35 50 L 38 48 L 42 50" stroke="#000" strokeWidth="1.5" fill="none" /></>;
    case 'wolf_mask':        return <><polygon points="22,28 28,12 32,24" fill="#555" /><polygon points="38,24 42,12 48,28" fill="#555" /><circle cx="35" cy="42" r="14" fill="#3a3a3a" opacity="0.8" /></>;
    default:                 return null;
  }
}

function renderBody(c) {
  switch (c.id) {
    case 'plain_tee':     return <path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="#3498db" opacity="0.9" />;
    case 'tie_dye_shirt': return <path d="M 14 56 Q 14 72 35 74 Q 56 72 56 56 Z" fill="url(#tieDye)" opacity="0.9" />;
    case 'scarf':         return <rect x="14" y="62" width="42" height="4" fill="#c0392b" />;
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
  // Arms = two small mitten/glove ellipses on either side of the body
  const col = {
    mittens:       '#e74c3c',
    bracelets:     '#f1c40f',
    gloves:        '#fff',
    wrist_watch:   '#1a1a1a',
    boxing_gloves: '#c0392b',
    gauntlets:     '#7f8c8d',
  }[c.id] || '#888';
  return (
    <>
      <ellipse cx="13" cy="60" rx="4" ry="5" fill={col} />
      <ellipse cx="57" cy="60" rx="4" ry="5" fill={col} />
    </>
  );
}

function renderFeet(c) {
  const col = {
    socks:          '#fff',
    sneakers:       '#e74c3c',
    rain_boots:     '#3498db',
    ankle_monitor:  '#7f8c8d',
    formal_shoes:   '#1a1a1a',
    winged_sandals: '#f1c40f',
  }[c.id] || '#444';
  return (
    <>
      <ellipse cx="24" cy="73" rx="6" ry="3" fill={col} />
      <ellipse cx="46" cy="73" rx="6" ry="3" fill={col} />
      {c.id === 'winged_sandals' && (
        <>
          <path d="M 18 72 L 14 68 L 18 70" stroke="#fff" strokeWidth="1" fill="none" />
          <path d="M 52 72 L 56 68 L 52 70" stroke="#fff" strokeWidth="1" fill="none" />
        </>
      )}
    </>
  );
}

function DeadSVG() {
  return (
    <svg width="80" height="80" viewBox="0 0 70 80">
      <ellipse cx="35" cy="60" rx="25" ry="14" fill="#222" opacity="0.7" />
      <text x="35" y="40" textAnchor="middle" fontSize="36">💀</text>
    </svg>
  );
}
