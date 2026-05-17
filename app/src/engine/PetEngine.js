/**
 * PetEngine.js
 * Core stat engine. Manages all 6 stats, token economy,
 * death detection, and environment state.
 * Pure logic — no React, no DOM. Called by App.jsx.
 */

export const DEFAULT_STATS = {
  hunger: 80,
  happiness: 70,
  cleanliness: 85,
  boredom: 20,
  sleepiness: 15,
  weight: 50,   // 50 = ideal, <30 = underweight, >70 = overweight
  health: 90,
};

export const STAT_CAPS = { min: 0, max: 100 };

// How much each stat drops per tick (60s)
const TICK_DECAY = {
  hunger: 3,
  cleanliness: 1.5,
  boredom: 2,       // increases when no tasks
  sleepiness: 0,    // managed by task load, not time
};

// Health only drops after sustained stat failure
const HEALTH_FAIL_THRESHOLD = 25;   // stat must be below this
const HEALTH_FAIL_TICKS = 10;       // consecutive ticks before health drops
const HEALTH_DROP_RATE = 5;         // per tick once failing

// Death conditions
const DEATH_HEALTH_ZERO_TICKS = 5;  // ticks at health=0 before death
const DEATH_HUNGER_ZERO_TICKS = 15; // ticks at hunger=0 before death

export class PetEngine {
  constructor(initialStats = {}) {
    this.stats = { ...DEFAULT_STATS, ...initialStats };
    this.tokens = initialStats.tokens ?? 50;
    this.envBugs = 0;               // code bugs in environment
    this.taskLoad = 0;              // rolling task load (for sleepiness)
    this.failTicks = {};            // tracks consecutive fail ticks per stat
    this.healthZeroTicks = 0;
    this.hungerZeroTicks = 0;
    this.lastTickTime = Date.now();
    this.sessionActive = false;
    this.lastSessionDate = null;
    this.happinessHistory = [];     // rolling 10-tick window
    this.cleanlinessHistory = [];
    this.listeners = [];
    // Phase 8: snapshot of passive-emitting items injected from the app.
    // Shape: [{ id, passive: {...} }, ...]
    this.passiveItems = [];
    this.onEvolutionBonus = null;   // callback(N) when items contribute evolution score
    // 💩 — the pet poops on the floor occasionally. Each entry is { id, xPct }.
    this.poops = Array.isArray(initialStats.poops) ? [...initialStats.poops] : [];
    // Each food item eaten makes a poop more likely some ticks later.
    this.foodSinceLastPoop = 0;
    // 😴 Well-rested buff (timestamp). While active, hunger & sleepiness decay
    // is reduced — the pet is more productive between meals.
    this.wellRestedUntil = initialStats.wellRestedUntil || 0;
    // Dev-tunable knobs. null = use module defaults above.
    this.tuning = {
      hungerDecay:       null,   // overrides TICK_DECAY.hunger
      cleanlinessDecay:  null,   // overrides TICK_DECAY.cleanliness
      boredomDecay:      null,   // overrides TICK_DECAY.boredom
      tokenMultiplier:   1,      // multiplies every token reward
      deathHungerTicks:  null,   // overrides DEATH_HUNGER_ZERO_TICKS
      deathHealthTicks:  null,   // overrides DEATH_HEALTH_ZERO_TICKS
    };
  }

  setTuning(patch = {}) {
    Object.assign(this.tuning, patch);
  }

  /** 😴 Nap — restore sleepiness immediately and grant a well-rested buff. */
  startNap(durationMs = 10 * 60 * 1000) {           // 10 minutes default
    this.stats.sleepiness = clamp(Math.max(0, this.stats.sleepiness - 50));
    this.stats.happiness  = clamp(this.stats.happiness + 8);
    this.wellRestedUntil  = Date.now() + durationMs;
    this._emit();
  }

  isWellRested() { return Date.now() < (this.wellRestedUntil || 0); }

  setPassiveItems(items = []) {
    // Deduplicate by id so the same item never double-applies.
    const seen = new Set();
    this.passiveItems = [];
    for (const it of items) {
      if (!it || !it.id || !it.passive) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      this.passiveItems.push(it);
    }
  }

  // ── Subscribe to state changes ─────────────────────────────────────────────
  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  _emit() {
    this.listeners.forEach(fn => fn(this.getState()));
  }

  getState() {
    return {
      stats: { ...this.stats },
      tokens: this.tokens,
      envBugs: this.envBugs,
      taskLoad: this.taskLoad,
      poops: [...this.poops],
      wellRestedUntil: this.wellRestedUntil,
    };
  }

  // ── Tick (called every 60s) ────────────────────────────────────────────────
  tick() {
    const s = this.stats;

    // Sum passive deltas (Phase 8). intelligenceMult is consumed externally.
    let passiveHappiness = 0;
    let passiveBoredom = 0;
    let passiveSleepinessTick = 0;
    let passiveEvolutionBonus = 0;
    for (const it of this.passiveItems) {
      const p = it.passive || {};
      if (typeof p.happiness        === 'number') passiveHappiness        += p.happiness;
      if (typeof p.boredom          === 'number') passiveBoredom          += p.boredom;
      if (typeof p.sleepinessTick   === 'number') passiveSleepinessTick   += p.sleepinessTick;
      if (typeof p.evolutionBonus   === 'number') passiveEvolutionBonus   += p.evolutionBonus;
    }

    // ── 💩 Poop logic ─────────────────────────────────────────────────────
    // Probabilistic: small baseline chance, much higher after recent feeds.
    // Capped so the floor never fully fills with poop.
    const MAX_POOPS = 8;
    if (this.poops.length < MAX_POOPS) {
      const base       = 0.04;                                        // 4% per tick when not fed recently
      const foodBonus  = Math.min(0.45, this.foodSinceLastPoop * 0.12);
      if (Math.random() < base + foodBonus) {
        this.poops.push({
          id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          xPct: 8 + Math.random() * 84,
        });
        this.foodSinceLastPoop = Math.max(0, this.foodSinceLastPoop - 1);
      }
    }

    // Basic decay (tuning overrides allow live adjustment from DevPanel)
    // Well-rested buff: hunger decays 35% slower while active.
    const buff       = this.isWellRested() ? 0.65 : 1;
    const dHunger    = (this.tuning.hungerDecay      ?? TICK_DECAY.hunger)      * buff;
    const dClean     = this.tuning.cleanlinessDecay ?? TICK_DECAY.cleanliness;
    const dBored     = this.tuning.boredomDecay     ?? TICK_DECAY.boredom;
    s.hunger      = clamp(s.hunger      - dHunger);
    // Poops drain cleanliness on top of bugs.
    s.cleanliness = clamp(s.cleanliness - dClean - (this.envBugs * 0.5) - (this.poops.length * 0.6));
    s.boredom     = clamp(s.boredom     + (this.sessionActive ? -1 : dBored) + passiveBoredom);

    // Sleepiness driven by task load. passiveSleepinessTick (negative) reduces accumulation.
    // Well-rested buff also slows sleepiness build-up.
    if (this.taskLoad > 5) {
      const sleepGain = Math.floor(this.taskLoad / 2) * (this.isWellRested() ? 0.5 : 1);
      s.sleepiness = clamp(s.sleepiness + sleepGain + passiveSleepinessTick);
    } else {
      s.sleepiness = clamp(s.sleepiness - 2 + passiveSleepinessTick); // recover when idle
    }
    this.taskLoad = Math.max(0, this.taskLoad - 1); // decay task load

    // Weight drifts toward 50 slowly, pushed by food (handled in applyItem)
    if (s.weight > 55) s.weight = clamp(s.weight - 0.5);
    if (s.weight < 45) s.weight = clamp(s.weight + 0.3);

    // Happiness composite
    const happinessDelta = this._calcHappinessDelta(s);
    s.happiness = clamp(s.happiness + happinessDelta + passiveHappiness);

    // Forward evolution bonus to the FSM via callback (App wires this).
    if (passiveEvolutionBonus !== 0 && typeof this.onEvolutionBonus === 'function') {
      try { this.onEvolutionBonus(passiveEvolutionBonus); } catch { /* noop */ }
    }

    // Rolling history
    this.happinessHistory.push(s.happiness);
    this.cleanlinessHistory.push(s.cleanliness);
    if (this.happinessHistory.length > 10) this.happinessHistory.shift();
    if (this.cleanlinessHistory.length > 10) this.cleanlinessHistory.shift();

    // Health (lagging indicator)
    this._updateHealth(s);

    // Death checks
    if (s.health <= 0) {
      this.healthZeroTicks++;
    } else {
      this.healthZeroTicks = 0;
    }
    if (s.hunger <= 0) {
      this.hungerZeroTicks++;
    } else {
      this.hungerZeroTicks = 0;
    }

    this._emit();

    return this._checkDeath();
  }

  _calcHappinessDelta(s) {
    let delta = 0;
    if (s.boredom > 60) delta -= 1;
    if (s.boredom > 80) delta -= 1;
    if (s.sleepiness > 70) delta -= 1;
    if (s.health < 50) delta -= 2;
    if (s.hunger < 30) delta -= 1;
    if (s.cleanliness < 30) delta -= 1;
    if (s.weight > 75 || s.weight < 25) delta -= 0.5;
    return delta;
  }

  _updateHealth(s) {
    const badStats = ['hunger', 'happiness', 'cleanliness'].filter(
      stat => s[stat] < HEALTH_FAIL_THRESHOLD
    );
    const extraBad = ['boredom', 'sleepiness'].filter(stat => s[stat] > 75);

    const failCount = badStats.length + extraBad.length;

    if (failCount > 0) {
      this.failTicks.health = (this.failTicks.health || 0) + 1;
      if (this.failTicks.health >= HEALTH_FAIL_TICKS) {
        s.health = clamp(s.health - (HEALTH_DROP_RATE * failCount * 0.5));
      }
    } else {
      this.failTicks.health = 0;
      // Slow recovery
      if (s.health < 100) s.health = clamp(s.health + 0.5);
    }
  }

  _checkDeath() {
    const deathHealthTicks = this.tuning.deathHealthTicks ?? DEATH_HEALTH_ZERO_TICKS;
    const deathHungerTicks = this.tuning.deathHungerTicks ?? DEATH_HUNGER_ZERO_TICKS;
    if (this.healthZeroTicks >= deathHealthTicks) return 'health';
    if (this.hungerZeroTicks >= deathHungerTicks) return 'starvation';
    // Warning zones
    if (this.stats.health <= 10) return 'warning_health';
    if (this.stats.hunger <= 10) return 'warning_hunger';
    return null;
  }

  // ── Hook Events ───────────────────────────────────────────────────────────
  onHookEvent(event) {
    const bonus = this.stats.boredom < 20 ? 1.5 : 1; // engaged bonus

    switch (event.hook) {
      case 'SessionStart':
        this.sessionActive = true;
        this._handleSessionStart();
        break;
      case 'SessionEnd':
        this.sessionActive = false;
        this.taskLoad = Math.max(0, this.taskLoad - 3);
        break;
      case 'PreToolUse':
        this.taskLoad = Math.min(20, this.taskLoad + 1);
        this.stats.boredom = clamp(this.stats.boredom - 5);
        this.tokens += Math.round(1 * bonus * (this.tuning.tokenMultiplier ?? 1));
        break;
      case 'PostToolUse':
        this.tokens += Math.round(2 * bonus * (this.tuning.tokenMultiplier ?? 1));
        this.stats.happiness = clamp(this.stats.happiness + 2);
        // Detect error tools → spawn bug
        if (this._isErrorTool(event)) {
          this.envBugs = Math.min(20, this.envBugs + 1);
          this.stats.cleanliness = clamp(this.stats.cleanliness - 3);
        }
        break;
      case 'Stop':
        this.tokens += Math.round(5 * bonus * (this.tuning.tokenMultiplier ?? 1));
        this.taskLoad = Math.max(0, this.taskLoad - 2);
        this.stats.happiness = clamp(this.stats.happiness + 3);
        break;
      case 'Notification':
        // idle_prompt = Claude waiting on user
        if (event.notification_type === 'idle_prompt') {
          this.stats.boredom = clamp(this.stats.boredom + 3);
        }
        break;
    }
    this._emit();
  }

  _handleSessionStart() {
    const today = new Date().toDateString();
    if (this.lastSessionDate !== today) {
      this.tokens += 10; // daily bonus
      this.lastSessionDate = today;
    }
    this.stats.boredom = clamp(this.stats.boredom - 10);
  }

  _isErrorTool(event) {
    // Heuristic: tool response contains error indicators
    if (!event.tool_response) return false;
    const resp = JSON.stringify(event.tool_response).toLowerCase();
    return resp.includes('error') || resp.includes('failed') || resp.includes('exception');
  }

  // ── Item Application ──────────────────────────────────────────────────────
  applyItem(item) {
    if (this.tokens < item.cost) return false;
    this.tokens -= item.cost;

    const s = this.stats;
    if (item.hunger)      s.hunger      = clamp(s.hunger      + item.hunger);
    if (item.happiness)   s.happiness   = clamp(s.happiness   + item.happiness);
    if (item.cleanliness) s.cleanliness = clamp(s.cleanliness + item.cleanliness);
    if (item.boredom)     s.boredom     = clamp(s.boredom     - item.boredom); // positive value = reduce boredom
    if (item.sleepiness)  s.sleepiness  = clamp(s.sleepiness  + item.sleepiness); // negative = reduce
    if (item.health)      s.health      = clamp(s.health      + item.health);
    if (item.weight)      s.weight      = clamp(s.weight      + item.weight);
    if (item.clearBugs)   this.envBugs  = 0;

    // Food/snacks make a poop more likely later (digestive realism, kinda).
    if (item.category === 'food' || item.category === 'snack' || item.foodQuality != null) {
      this.foodSinceLastPoop = Math.min(8, (this.foodSinceLastPoop || 0) + 1);
    }

    this._emit();
    return true;
  }

  // ── Stat delta application (games, generic effects) ──────────────────────
  applyStatDelta(delta = {}) {
    const s = this.stats;
    for (const key of Object.keys(delta)) {
      if (key === 'tokens') { this.tokens = Math.max(0, this.tokens + delta.tokens); continue; }
      if (key === 'envBugs') { this.envBugs = Math.max(0, this.envBugs + delta.envBugs); continue; }
      if (!(key in s)) continue;
      // boredom delta is intuitive: positive = more bored, negative = less bored
      s[key] = clamp(s[key] + delta[key]);
    }
    this._emit();
  }

  cleanEnvironment(cost = 10) {
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    this.envBugs = 0;
    this.poops = [];                                              // 💩 → 🧼
    this.stats.cleanliness = clamp(this.stats.cleanliness + 20);
    this._emit();
    return true;
  }
}

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}
