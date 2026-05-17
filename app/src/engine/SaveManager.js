/**
 * SaveManager.js
 * Handles serializing/deserializing pet state to disk via Electron IPC.
 * Auto-saves every 30 seconds and on significant events.
 */

const SAVE_VERSION = 1;
const AUTO_SAVE_INTERVAL = 30_000; // 30s

export class SaveManager {
  constructor() {
    this.autoSaveTimer = null;
    this.pendingSave = false;
  }

  async load() {
    if (!window.claudigotchi) return null;
    const result = await window.claudigotchi.loadData();
    if (!result.ok || !result.data) return null;
    if (result.data.version !== SAVE_VERSION) {
      console.warn('[SaveManager] Save version mismatch — starting fresh');
      return null;
    }
    return result.data;
  }

  async save(petState, tombstones, meta = {}) {
    if (!window.claudigotchi) return;
    const data = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      currentPet: petState,
      tombstones: tombstones || [],
      totalTokensEarned: meta.totalTokensEarned || 0,
      lastSessionDate: meta.lastSessionDate || null,
    };
    await window.claudigotchi.saveData(data);
  }

  startAutoSave(getSaveData) {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(async () => {
      const { petState, tombstones, meta } = getSaveData();
      await this.save(petState, tombstones, meta);
    }, AUTO_SAVE_INTERVAL);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  buildPetState(appearance, stats, evolution, tokens, name, inventory, housing, clothing) {
    return {
      seed: appearance.seed,
      name,
      stage: evolution.stage,
      personalityKey: appearance.adult.personalityKey,
      appearance: {
        egg: appearance.egg,
        hatchling: appearance.hatchling,
        adolescent: appearance.adolescent,
        adult: appearance.adult,
      },
      stats: { ...stats },
      evolutionScore: evolution.evolutionScore,
      evolutionThresholds: evolution.thresholds,
      tokens,
      age: evolution.ticksSinceLastEvo,
      born: new Date().toISOString(),
      inventory: inventory || [],
      housing: housing || 'default',
      clothing: clothing || [],
    };
  }

  buildTombstone(petState, cause) {
    return {
      name: petState.name || 'Unknown',
      personality: petState.personalityKey,
      born: petState.born,
      died: new Date().toISOString(),
      cause,
      stage: petState.stage,
      stageName: ['Egg', 'Hatchling', 'Adolescent', 'Adult'][petState.stage] || 'Unknown',
    };
  }
}
