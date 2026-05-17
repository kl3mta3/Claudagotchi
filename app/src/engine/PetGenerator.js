/**
 * PetGenerator.js
 * Generates a full adult pet appearance from a seed, then derives
 * egg, hatchling, and adolescent forms from that adult.
 * All generation is deterministic given the same seed.
 */

const PERSONALITIES = ['peppy', 'grumpy', 'lazy', 'emo', 'nerdy', 'snarky', 'zen', 'dramatic'];
const BODY_SHAPES = ['round', 'chunky', 'slim', 'wide'];
const EAR_TYPES = ['round', 'pointy', 'floppy', 'none'];
const TAIL_TYPES = ['stubby', 'long', 'curly', 'none'];
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

function randomHSL(rng, hueMin = 0, hueMax = 360, satMin = 50, satMax = 90, litMin = 45, litMax = 70) {
  const h = Math.floor(hueMin + rng() * (hueMax - hueMin));
  const s = Math.floor(satMin + rng() * (satMax - satMin));
  const l = Math.floor(litMin + rng() * (litMax - litMin));
  return { h, s, l, css: `hsl(${h}, ${s}%, ${l}%)` };
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

export function generatePet(seed) {
  const rng = makePRNG(seed);

  // ── Adult form ──────────────────────────────────────────────────────────────
  const primaryColor = randomHSL(rng);
  const useComplementary = rng() > 0.5;
  const accentColor = useComplementary ? complementary(primaryColor) : analogous(primaryColor, 40 + Math.floor(rng() * 40));
  const eyeColor = darken(complementary(primaryColor), 20);
  const cheekColor = analogous(primaryColor, -20);
  cheekColor.l = Math.min(80, cheekColor.l + 15);

  const adult = {
    bodyShape: pickFrom(BODY_SHAPES, rng),
    earType: pickFrom(EAR_TYPES, rng),
    tailType: pickFrom(TAIL_TYPES, rng),
    eyeShape: pickFrom(EYE_SHAPES, rng),
    personalityKey: pickFrom(PERSONALITIES, rng),
    primaryColor,
    accentColor,
    eyeColor,
    cheekColor,
    highlightColor: { css: `hsl(${primaryColor.h}, 30%, 85%)` },
  };

  // ── Egg form ────────────────────────────────────────────────────────────────
  const eggBase = desaturate(primaryColor, 25);
  eggBase.l = Math.min(80, eggBase.l + 10);
  const eggPatterns = ['dots', 'stripes', 'blotches'];
  const egg = {
    baseColor: eggBase,
    speckleColor: accentColor,
    pattern: pickFrom(eggPatterns, rng),
    patternDensity: 0.3 + rng() * 0.4,
  };

  // ── Hatchling form ──────────────────────────────────────────────────────────
  const blobColor = desaturate(primaryColor, 15);
  blobColor.l = Math.min(75, blobColor.l + 5);
  const hatchling = {
    blobColor,
    eyeColor: adult.eyeColor,
    size: 0.6, // relative to adult
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

  return { seed, egg, hatchling, adolescent, adult };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2147483647);
}
