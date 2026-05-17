/**
 * EvolutionFSM.js
 * Manages life stage transitions: egg → hatchling → adolescent → adult
 * Evolution score accumulates from weighted inputs with noise.
 * Thresholds are randomized per-pet so evolution never feels predictable.
 */

export const STAGES = {
  EGG: 0,
  HATCHLING: 1,
  ADOLESCENT: 2,
  ADULT: 3,
  DEAD: 4,
};

export const STAGE_NAMES = ['Egg', 'Hatchling', 'Adolescent', 'Adult', 'Gone'];
export const STAGE_EMOJIS = ['🥚', '🫧', '🐣', '🐾', '💀'];

// Threshold ranges per transition (randomized on creation)
const THRESHOLD_RANGES = {
  [STAGES.EGG]:        { min: 80,  max: 140 },
  [STAGES.HATCHLING]:  { min: 200, max: 320 },
  [STAGES.ADOLESCENT]: { min: 400, max: 600 },
};

export function generateThresholds(rng) {
  const result = {};
  for (const [stage, range] of Object.entries(THRESHOLD_RANGES)) {
    result[stage] = Math.floor(range.min + rng() * (range.max - range.min));
  }
  return result;
}

// Simple seeded PRNG for threshold generation
function makePRNG(seed) {
  let s = (seed ^ 0xDEADBEEF) >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class EvolutionFSM {
  constructor({ stage = STAGES.EGG, evolutionScore = 0, thresholds = null, seed = 1 } = {}) {
    this.stage = stage;
    this.evolutionScore = evolutionScore;
    const rng = makePRNG(seed + 999); // offset seed so different from appearance seed
    this.thresholds = thresholds || generateThresholds(rng);
    this.ticksSinceLastEvo = 0;
    this.foodQualityHistory = [];  // rolling window
    this.toyInteractions = 0;
    this.pendingEvolution = false;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  _emit(type, data = {}) {
    this.listeners.forEach(fn => fn({ type, stage: this.stage, ...data }));
  }

  getState() {
    return {
      stage: this.stage,
      stageName: STAGE_NAMES[this.stage],
      stageEmoji: STAGE_EMOJIS[this.stage],
      evolutionScore: this.evolutionScore,
      threshold: this.thresholds[this.stage] ?? null,
      progress: this.stage < STAGES.ADULT
        ? Math.min(1, this.evolutionScore / (this.thresholds[this.stage] ?? 1))
        : 1,
    };
  }

  // Called every stat tick
  tick(stats) {
    if (this.stage >= STAGES.ADULT) return;

    this.ticksSinceLastEvo++;

    // Food quality: ratio of health food fed (tracked externally via recordFood)
    const foodQuality = this._avgFoodQuality();

    // Happiness rolling average
    const happinessAvg = stats.happiness / 100;
    const cleanlinessAvg = stats.cleanliness / 100;

    // Noise: ±5%
    const noise = (Math.random() - 0.5) * 0.1;

    const delta =
      (foodQuality    * 0.30) +
      (0.20)                  +  // age ticks always contribute
      (Math.min(this.toyInteractions / 20, 1) * 0.25) +
      (happinessAvg   * 0.15) +
      (cleanlinessAvg * 0.10) +
      noise;

    this.evolutionScore += Math.max(0, delta * 10); // scale to reasonable numbers

    // Check evolution
    const threshold = this.thresholds[this.stage];
    if (threshold !== undefined && this.evolutionScore >= threshold) {
      this._triggerEvolution();
    }

    this._emit('tick');
  }

  _triggerEvolution() {
    const fromStage = this.stage;
    this.stage = Math.min(this.stage + 1, STAGES.ADULT);
    this.evolutionScore = 0;
    this.ticksSinceLastEvo = 0;
    this.pendingEvolution = true;
    this._emit('evolution', { fromStage, toStage: this.stage });
  }

  // Called when pet eats something
  recordFood(quality) {
    // quality: 0 (junk) to 1 (healthy)
    this.foodQualityHistory.push(quality);
    if (this.foodQualityHistory.length > 20) this.foodQualityHistory.shift();
  }

  recordToyUse() {
    this.toyInteractions++;
  }

  _avgFoodQuality() {
    if (!this.foodQualityHistory.length) return 0.3; // default neutral
    return this.foodQualityHistory.reduce((a, b) => a + b, 0) / this.foodQualityHistory.length;
  }

  die() {
    this.stage = STAGES.DEAD;
    this._emit('death');
  }

  confirmEvolution() {
    this.pendingEvolution = false;
  }

  // Dev-panel helper: jump straight to the next stage (no threshold needed).
  // Returns true if it actually evolved (was below ADULT), false if already adult.
  forceEvolve() {
    if (this.stage >= STAGES.ADULT) return false;
    this._triggerEvolution();
    return true;
  }
}
