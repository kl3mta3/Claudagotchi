/**
 * Inventory.js
 * Manages purchased items: consumables stack as counts, housing/clothing
 * track which is equipped. Pure logic — no React state.
 *
 * Clothing slot model (Phase 8): canonical slots are 'head' | 'body' | 'arms' | 'feet'.
 * Legacy slot names (hat/eyes/neck/back/body) are migrated on construction.
 *
 * Stage gating: egg=none, hatchling=head only, adolescent+=all four.
 */

import { getItemById } from './ShopItems.js';

// Legacy → canonical slot map
const SLOT_MIGRATION = {
  hat:   'head',
  eyes:  'head',
  neck:  'body',
  back:  'body',
  body:  'body',
  // already canonical:
  head:  'head',
  arms:  'arms',
  feet:  'feet',
};

const STAGE_SLOTS = {
  0: new Set(),                          // egg
  1: new Set(['head']),                  // hatchling
  2: new Set(['head', 'body', 'arms', 'feet']),
  3: new Set(['head', 'body', 'arms', 'feet']),
  4: new Set(),                          // dead
};

export class Inventory {
  constructor(initial = []) {
    // initial: array of { id, count?, equipped?, slot? }
    const arr = Array.isArray(initial) ? [...initial] : [];
    // One-time migration of old slot names on each item + default placed for legacy saves
    for (const it of arr) {
      if (it && it.slot && SLOT_MIGRATION[it.slot] && SLOT_MIGRATION[it.slot] !== it.slot) {
        it.slot = SLOT_MIGRATION[it.slot];
      }
      // Backfill: items saved before the placed-state existed default to placed
      if (it && it.placed === undefined) it.placed = true;
    }
    this.items = arr;
  }

  add(item) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      // Re-place if it was previously cleared from the room.
      if (existing.placed === false) existing.placed = true;
    } else {
      const slot = item.slot ? (SLOT_MIGRATION[item.slot] || item.slot) : undefined;
      // Furniture items default to placed in the room on first purchase.
      this.items.push({ id: item.id, count: 1, slot, category: item.category, placed: true });
    }
    return this.items;
  }

  /**
   * Add a new INSTANCE of a decoration (multiple-allowed) — each purchase
   * creates a unique inventory entry so the user can buy and place several.
   * The new entry's id is `${item.id}#<uid>` so it remains a distinct key
   * for positions / sprites / trash without changing any existing lookups.
   * baseId is preserved separately so renderers can look up the catalog entry.
   */
  addInstance(item) {
    const uid = Math.random().toString(36).slice(2, 8);
    const entry = {
      id: `${item.id}#${uid}`,
      baseId: item.id,
      count: 1,
      category: item.category,
      placed: true,
    };
    this.items.push(entry);
    return entry;
  }

  /** Remove a single item entry entirely (used by the trash drop zone). */
  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    return this.items.length !== before;
  }

  /** Mark a single item as placed/un-placed in the room. Inventory is unchanged. */
  setPlaced(id, placed) {
    const it = this.items.find(i => i.id === id);
    if (!it) return false;
    it.placed = !!placed;
    return true;
  }

  /** Un-place every furniture item (keep them in inventory for re-placement). */
  clearAllPlaced() {
    for (const it of this.items) {
      // Don't touch equipped clothing — that's separate from the room layout.
      if (!it.equipped) it.placed = false;
    }
  }

  consume(id) {
    const it = this.items.find(i => i.id === id);
    if (!it || (it.count ?? 0) <= 0) return false;
    it.count -= 1;
    if (it.count <= 0) this.items = this.items.filter(i => i.id !== id);
    return true;
  }

  has(id) {
    return !!this.items.find(i => i.id === id && (i.count ?? 1) > 0);
  }

  /** Equip a clothing item by id, auto-unequipping any prior occupant of its slot. */
  equip(itemId) {
    const def = getItemById(itemId);
    if (!def || !def.slot) return false;
    const slot = SLOT_MIGRATION[def.slot] || def.slot;

    // Ensure the item is in inventory; if not, add it.
    let entry = this.items.find(i => i.id === itemId);
    if (!entry) {
      this.add(def);
      entry = this.items.find(i => i.id === itemId);
    }
    if (!entry) return false;

    // Unequip any other items in the same slot
    for (const it of this.items) {
      if (it.id !== itemId && it.equipped && (it.slot === slot)) {
        it.equipped = false;
      }
    }
    entry.slot = slot;
    entry.equipped = true;
    return true;
  }

  unequip(slot) {
    const target = SLOT_MIGRATION[slot] || slot;
    let changed = false;
    for (const it of this.items) {
      if (it.equipped && it.slot === target) {
        it.equipped = false;
        changed = true;
      }
    }
    return changed;
  }

  equipped(slot) {
    const target = SLOT_MIGRATION[slot] || slot;
    return this.items.filter(i => i.equipped && i.slot === target);
  }

  /** All equipped items the given stage allows. */
  getEquipped(stage = 3) {
    const allowed = STAGE_SLOTS[stage] || new Set();
    return this.items
      .filter(i => i.equipped && i.slot && allowed.has(i.slot))
      .map(i => {
        const def = getItemById(i.id);
        return { ...def, ...i };
      });
  }

  list() {
    return [...this.items];
  }
}

export { SLOT_MIGRATION, STAGE_SLOTS };
