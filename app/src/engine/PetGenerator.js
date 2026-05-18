/**
 * PetGenerator.js
 * Generates a full adult pet appearance from a seed, then derives
 * egg, hatchling, and adolescent forms from that adult.
 * All generation is deterministic given the same seed.
 */

const PERSONALITIES = ['peppy', 'grumpy', 'lazy', 'emo', 'nerdy', 'snarky', 'zen', 'dramatic'];
const BODY_SHAPES = ['round', 'chunky', 'slim', 'wide', 'petite'];
const EAR_TYPES = ['round', 'pointy', 'floppy', 'tufted', 'none'];
const TAIL_TYPES = ['stubby', 'long', 'curly', 'puff', 'none'];
const EYE_SHAPES = ['round', 'almond', 'wide', 'sleepy'];

// Simple seeded PRNG (mulberry32)
function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function randomHSL(rng, hueMin = 0, hueMax = 360, satMin = 55, satMax = 85, litMin = 50, litMax = 68) {
  // Constrain saturation + lightness to readable mid-range. Hues stay full.
  const h = Math.floor(hueMin + rng() * (hueMax - hueMin));
  const s = Math.floor(satMin + rng() * (satMax - satMin));
  const l = Math.floor(litMin + rng() * (litMax - litMin));
  return { h, s, l, css: `hsl(${h}, ${s}%, ${l}%)` };
}

/** Skip a narrow "muddy yellow-green" band (hue ~50-90) that tends to look
 *  like baby food on round pets. Re-rolls into a friendlier hue if hit. */
function pleasantHue(rng) {
  for (let i = 0; i < 5; i++) {
    const h = Math.floor(rng() * 360);
    if (h < 50 || h > 90) return h;
  }
  return Math.floor(rng() * 360);
}

function complementary(hsl) {
  return { ...hsl, h: (hsl.h + 180) % 360, css: `hsl(${(hsl.h + 180) % 360}, ${hsl.s}%, ${hsl.l}%)` };
}

function analogous(hsl, offset = 40) {
  const h = (hsl.h + offset) % 360;
  return { ...hsl, h, css: `hsl(${h}, ${hsl.s}%, ${hsl.l}%)` };
}

function darken(hsl, amount = 15) {
  const l = Math.max(10, hsl.l - amount);
  return { ...hsl, l, css: `hsl(${hsl.h}, ${hsl.s}%, ${l}%)` };
}

function desaturate(hsl, amount = 30) {
  const s = Math.max(0, hsl.s - amount);
  return { ...hsl, s, css: `hsl(${hsl.h}, ${s}%, ${hsl.l}%)` };
}

export function generatePet(seed, opts = {}) {
  const rng = makePRNG(seed);

  // SHINY — 1% natural rate, like a shiny Pokémon. Adds a metallic gold
  // overlay + animated sparkles on top of the normal colors. The dev tool
  // can force this via opts.forceShiny.
  const isShiny = opts.forceShiny || rng() < 0.01;

  // ── Adult form ──────────────────────────────────────────────────────────────
  // Use the muddy-band-skipping hue picker so we don't routinely roll the
  // yellow-green ~50..90° pets that look like split-pea soup.
  const baseHue = pleasantHue(rng);
  const primaryColor = randomHSL(rng, baseHue, baseHue + 1);
  const useComplementary = rng() > 0.5;
  const accentColor = useComplementary ? complementary(primaryColor) : analogous(primaryColor, 40 + Math.floor(rng() * 40));
  const eyeColor = darken(complementary(primaryColor), 20);
  const cheekColor = analogous(primaryColor, -20);
  cheekColor.l = Math.min(80, cheekColor.l + 15);

  // ── Distinctive traits ──────────────────────────────────────────────────
  // Body markings — flat / stripes / spots / belly / mask.
  const markings    = pickFrom(['none', 'stripes', 'spots', 'belly', 'belly-mask', 'mask', 'gradient'], rng);
  const stripeCount = 2 + Math.floor(rng() * 3);                       // 2..4 stripes
  const spotCount   = 4 + Math.floor(rng() * 6);                       // 4..9 spots
  // Eye details
  const pupilShape  = pickFrom(['round', 'slit', 'dot', 'star', 'plus'], rng);
  const heterochromia = rng() < 0.12;                                  // 12% chance
  const eyeColor2   = heterochromia
    ? darken({ ...primaryColor, h: (primaryColor.h + 120) % 360 }, 20)
    : eyeColor;
  // Mouth — neutral / smile / smirk / fang / open
  const mouthShape  = pickFrom(['neutral', 'smile', 'smirk', 'fang', 'open'], rng);
  // Optional extras
  const hasHorns    = rng() < 0.10;
  const hasWings    = rng() < 0.05;
  const hasFreckles = rng() < 0.20;
  // Ear tip color (always present for tufted, sometimes elsewhere)
  const earType = pickFrom(EAR_TYPES, rng);
  const tipAccent = earType === 'tufted' || rng() < 0.30;

  const adult = {
    bodyShape: pickFrom(BODY_SHAPES, rng),
    earType,
    tailType: pickFrom(TAIL_TYPES, rng),
    eyeShape: pickFrom(EYE_SHAPES, rng),
    personalityKey: pickFrom(PERSONALITIES, rng),
    primaryColor,
    accentColor,
    eyeColor,
    eyeColor2,
    heterochromia,
    cheekColor,
    highlightColor: { css: `hsl(${primaryColor.h}, 30%, 85%)` },
    markings,
    stripeCount,
    spotCount,
    pupilShape,
    mouthShape,
    hasHorns,
    hasWings,
    hasFreckles,
    tipAccent,
  };

  // ── Egg form ────────────────────────────────────────────────────────────────
  const eggBase = desaturate(primaryColor, 25);
  eggBase.l = Math.min(80, eggBase.l + 10);
  const eggPatterns = ['dots', 'stripes', 'blotches'];
  // Three progressive crack paths, drawn deterministically from seed.
  // Each is a short polyline across the upper half of the egg.
  function makeCrack() {
    const startX = 14 + Math.floor(rng() * 14);            // 14..28
    const startY = 22 + Math.floor(rng() * 10);            // 22..32
    let x = startX, y = startY;
    const pts = [`M ${x} ${y}`];
    const steps = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < steps; i++) {
      x += 3 + Math.floor(rng() * 5);
      y += (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3));
      pts.push(`L ${x} ${y}`);
    }
    return pts.join(' ');
  }
  const egg = {
    baseColor: eggBase,
    speckleColor: accentColor,
    pattern: pickFrom(eggPatterns, rng),
    patternDensity: 0.3 + rng() * 0.4,
    crackStages: [makeCrack(), makeCrack(), makeCrack()],   // progressive: 1, 2, 3 cracks
  };

  // ── Hatchling form ──────────────────────────────────────────────────────────
  // Hatchlings get their OWN hue so they're not always "smaller paler adult".
  // Most stay close to the adult's hue family for narrative continuity, but
  // ~35% break out to a contrasting hue (juvenile color, darkens with age).
  const hatchHueShift = rng() < 0.35 ? (60 + Math.floor(rng() * 240)) : (-15 + Math.floor(rng() * 31));
  const hatchHue = (primaryColor.h + hatchHueShift + 360) % 360;
  const blobColor = {
    h: hatchHue,
    s: Math.max(40, primaryColor.s - 5),
    l: Math.min(72, primaryColor.l + 8),
    css: `hsl(${hatchHue}, ${Math.max(40, primaryColor.s - 5)}%, ${Math.min(72, primaryColor.l + 8)}%)`,
  };
  // ARCHETYPE — vary aspect ratio + base radius so hatchlings have visibly
  // different silhouettes, not just slight blob jitters.
  //   tall    — taller-than-wide blob (egg-ish standing)
  //   wide    — wider-than-tall blob (puddle)
  //   round   — symmetric
  //   peanut  — pinched middle (figure-8 vibe)
  //   spiky   — exaggerated anchors (more pseudopods)
  const archetypes = ['round', 'tall', 'wide', 'peanut', 'spiky'];
  const archetype = archetypes[Math.floor(rng() * archetypes.length)];
  const baseRadius = 18 + Math.floor(rng() * 10);             // 18..27
  // 8 polar anchors with archetype-specific shaping
  const blobAnchors = [];
  for (let i = 0; i < 8; i++) {
    const baseAngle = (i / 8) * Math.PI * 2;
    let jitter = 0.85 + rng() * 0.35;                          // 0.85..1.20 default
    // Squash/stretch per archetype
    if (archetype === 'tall'  && (i === 2 || i === 6)) jitter *= 0.72;
    if (archetype === 'wide'  && (i === 0 || i === 4)) jitter *= 0.72;
    if (archetype === 'peanut' && (i === 1 || i === 5)) jitter *= 0.55;
    if (archetype === 'spiky') jitter *= 0.8 + rng() * 0.6;
    blobAnchors.push({ angle: baseAngle, radius: jitter });
  }
  const blobBumpAt = (archetype === 'spiky' || rng() < 0.55)
    ? Math.floor(rng() * 8)
    : -1;
  // ~25% get a pair of "antenna" stubs poking from the top — pure variety.
  const hasAntennae = rng() < 0.25;
  const hatchling = {
    blobColor,
    eyeColor: adult.eyeColor,
    cheekColor: adult.cheekColor,
    size: 0.6,
    archetype,
    baseRadius,
    anchors: blobAnchors,
    bumpAt:  blobBumpAt,
    hasAntennae,
    antennaColor: adult.accentColor,
  };

  // ── Adolescent form ─────────────────────────────────────────────────────────
  const adolescent = {
    primaryColor: desaturate(primaryColor, 8),
    accentColor,
    eyeColor: adult.eyeColor,
    cheekColor: adult.cheekColor,
    bodyShape: adult.bodyShape,
    earType: adult.earType,
    earScale: 0.7, // smaller ears
    tailType: adult.tailType,
    eyeShape: adult.eyeShape,
    size: 0.8,
  };

  return { seed, isShiny, egg, hatchling, adolescent, adult };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2147483647);
}
