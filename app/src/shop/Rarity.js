/**
 * Rarity.js
 * Tier definitions for shop items. Drives border color, label, and cost-range
 * sanity checks. Items without a `rarity` field default to 'common'.
 */

export const RARITIES = {
  common:    { color: '#9b9b9b', label: 'Common',    costRange: [3, 30] },
  rare:      { color: '#5dade2', label: 'Rare',      costRange: [30, 100] },
  epic:      { color: '#a855f7', label: 'Epic',      costRange: [100, 300] },
  legendary: { color: '#ffd700', label: 'Legendary', costRange: [300, 9999] },
};

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export function rarityOf(item) {
  return RARITIES[item?.rarity] || RARITIES.common;
}
