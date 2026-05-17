/**
 * IntelligenceEngine.js
 * Manages the Intelligence stat.
 * INT never drops, is not capped at 100 — grows forever.
 * Shown as a raw number: INT: 247
 */

export class IntelligenceEngine {
  constructor({ intelligence = 0, projectDepthMap = {} } = {}) {
    this.intelligence   = intelligence;
    this.projectDepthMap = projectDepthMap; // { folderPath: sessionCount }
    this.currentProject = null;
    this.passiveMultiplier = 1.0; // modified by clothing/housing
  }

  // Called on every message turn completion
  onTurnComplete({ tokensUsed, responseLength, toolCallCount, codeBlockCount, projectFolder, intelligenceMult = 1 }) {
    // Track project depth
    if (projectFolder) {
      this.currentProject = projectFolder;
      this.projectDepthMap[projectFolder] = (this.projectDepthMap[projectFolder] ?? 0) + 1;
    }

    const projectDepth = projectFolder
      ? Math.min(this.projectDepthMap[projectFolder] ?? 1, 50) // cap at 50 for sanity
      : 1;

    // Complexity score — rough proxy for message depth
    const complexityScore =
      (responseLength / 500) +          // longer responses = more complex
      (toolCallCount * 1.5) +            // tool use = deep work
      (codeBlockCount * 1.0);            // code generated

    const delta =
      ((tokensUsed ?? 0)    * 0.01)   +
      (complexityScore      * 0.5)    +
      (projectDepth         * 0.8)    +   // same project over time = big boost
      (Math.random() * 0.2);              // small noise

    this.intelligence += delta * this.passiveMultiplier * (intelligenceMult || 1);
    return this.intelligence;
  }

  // Called by shop items with passive intel bonuses
  setPassiveMultiplier(mult) {
    this.passiveMultiplier = mult;
  }

  // Calculate multiplier from all worn clothing + housing
  recalcPassiveMultiplier(inventory, clothing) {
    let mult = 1.0;
    // Clothing bonuses
    clothing.forEach(item => {
      if (item.passive?.intelligenceGrowth) {
        mult += item.passive.intelligenceGrowth;
      }
    });
    // Housing bonuses (bookshelf, whiteboard etc)
    inventory.forEach(item => {
      if (item.isHousing && item.passive?.intelligenceGrowth) {
        mult += item.passive.intelligenceGrowth;
      }
    });
    this.passiveMultiplier = mult;
  }

  getDisplay() {
    return Math.floor(this.intelligence);
  }

  getState() {
    return {
      intelligence: this.intelligence,
      projectDepthMap: this.projectDepthMap,
      passiveMultiplier: this.passiveMultiplier,
    };
  }
}
