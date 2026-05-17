/**
 * ShopItems.js
 * All purchasable items. Each item defines:
 *   - id, name, description, cost, category, rarity
 *   - stat effects (applied via PetEngine.applyItem)
 *   - stageRequired: minimum stage to purchase
 *   - foodQuality: 0-1 (for evolution tracking, food items only)
 *   - slot: 'head' | 'body' | 'arms' | 'feet' (clothing only)
 *   - passive: { intelligenceMult, happiness, boredom, sleepinessTick, evolutionBonus }
 *   - achievement?: id from AchievementEngine — required to unlock
 *   - bundle?: [itemIds]  — outfit bundles equip multiple slots at once
 */

export const ITEM_CATEGORIES = {
  FOOD: 'food',
  SNACK: 'snack',
  TOY: 'toy',
  CONSUMABLE: 'consumable',
  HOUSING: 'housing',
  CLOTHING: 'clothing',
  INSTRUMENT: 'instrument',
  GAME_UNLOCK: 'game_unlock',
  FOREGROUND: 'foreground',
  DECORATION: 'decoration',
};

export const SHOP_ITEMS = [
  // ── Food ──────────────────────────────────────────────────────────────────
  { id: 'kibble',        name: 'Kibble',        emoji: '🥣', description: 'Basic nutrition. Gets the job done.', cost: 5,  rarity: 'common', category: ITEM_CATEGORIES.FOOD,  stageRequired: 0, foodQuality: 0.4, hunger: 20, weight: 0 },
  { id: 'salad',         name: 'Salad',         emoji: '🥗', description: 'Healthy greens. Pet might complain.', cost: 15, rarity: 'common', category: ITEM_CATEGORIES.FOOD,  stageRequired: 0, foodQuality: 0.9, hunger: 25, weight: -5, health: 10 },
  { id: 'pizza',         name: 'Pizza Slice',   emoji: '🍕', description: 'Delicious but not exactly a superfood.', cost: 8, rarity: 'common', category: ITEM_CATEGORIES.SNACK, stageRequired: 0, foodQuality: 0.2, hunger: 20, weight: 8, health: -5, happiness: 15 },
  { id: 'power_bar',     name: 'Power Bar',     emoji: '🍫', description: 'Optimized fuel. Very nutritious.',    cost: 20, rarity: 'common', category: ITEM_CATEGORIES.FOOD,  stageRequired: 0, foodQuality: 0.8, hunger: 30, weight: 0, health: 10, happiness: 5 },
  { id: 'mystery_snack', name: 'Mystery Snack', emoji: '❓', description: 'Unknown origins. Huge happiness spike.', cost: 3, rarity: 'common', category: ITEM_CATEGORIES.SNACK, stageRequired: 0, foodQuality: 0.1, hunger: 10, weight: 5, health: -2, happiness: 20 },
  { id: 'fresh_fish',    name: 'Fresh Fish',    emoji: '🐟', description: 'Premium omega-3 rich meal.',          cost: 25, rarity: 'common', category: ITEM_CATEGORIES.FOOD,  stageRequired: 1, foodQuality: 1.0, hunger: 35, weight: -5, health: 15, happiness: 10 },

  // ── Toys ──────────────────────────────────────────────────────────────────
  { id: 'rubber_ball',   name: 'Rubber Ball',   emoji: '⚽', description: 'Classic. Bounces around the room.', cost: 15, rarity: 'common', category: ITEM_CATEGORIES.TOY, stageRequired: 0, boredom: 20, happiness: 10, isToy: true, persistent: true },
  { id: 'squeaky_toy',   name: 'Squeaky Toy',   emoji: '🦴', description: 'Squeak squeak squeak.',             cost: 20, rarity: 'common', category: ITEM_CATEGORIES.TOY, stageRequired: 0, boredom: 22, happiness: 12, isToy: true, persistent: true },
  { id: 'plushie',       name: 'Plushie',       emoji: '🧸', description: 'A soft companion. Sits in the room.', cost: 35, rarity: 'common', category: ITEM_CATEGORIES.TOY, stageRequired: 0, boredom: 18, happiness: 14, isToy: true, persistent: true },
  { id: 'doll',          name: 'Doll',          emoji: '🪆', description: 'Pet carries it around on play.',    cost: 60, rarity: 'rare',   category: ITEM_CATEGORIES.TOY, stageRequired: 1, boredom: 30, happiness: 18, isToy: true, persistent: true },
  { id: 'laser_pointer', name: 'Laser Pointer', emoji: '🔴', description: 'Endless entertainment.',            cost: 15, rarity: 'common', category: ITEM_CATEGORIES.TOY, stageRequired: 1, boredom: 30, happiness: 20, isToy: true },
  { id: 'puzzle_box',    name: 'Puzzle Box',    emoji: '📦', description: 'Mental stimulation.',                cost: 25, rarity: 'common', category: ITEM_CATEGORIES.TOY, stageRequired: 1, boredom: 40, happiness: 15, isToy: true },

  // ── Consumables ───────────────────────────────────────────────────────────
  { id: 'shampoo',       name: 'Shampoo',       emoji: '🧴', description: 'Squeaky clean.',                     cost: 8,  rarity: 'common', category: ITEM_CATEGORIES.CONSUMABLE, stageRequired: 0, cleanliness: 40 },
  { id: 'bug_spray',     name: 'Bug Spray',     emoji: '🐛', description: 'Clears code bugs.',                  cost: 10, rarity: 'common', category: ITEM_CATEGORIES.CONSUMABLE, stageRequired: 0, clearBugs: true, cleanliness: 10 },
  { id: 'energy_drink',  name: 'Energy Drink',  emoji: '⚡', description: 'Wake up time.',                      cost: 12, rarity: 'common', category: ITEM_CATEGORIES.CONSUMABLE, stageRequired: 1, sleepiness: -30, happiness: 10 },
  { id: 'vitamins',      name: 'Vitamins',      emoji: '💊', description: 'Direct health boost.',               cost: 20, rarity: 'common', category: ITEM_CATEGORIES.CONSUMABLE, stageRequired: 1, health: 20 },
  { id: 'catnip',        name: 'Catnip',        emoji: '🌿', description: 'Happiness spike.',                   cost: 15, rarity: 'common', category: ITEM_CATEGORIES.CONSUMABLE, stageRequired: 2, happiness: 40, special: 'catnip' },

  // ── Housing — Wallpapers ──────────────────────────────────────────────────
  { id: 'wallpaper_forest', name: 'Forest Wallpaper', emoji: '🌲', description: 'A calming woodland backdrop.', cost: 50,  rarity: 'rare', category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, isHousing: true, housingId: 'wallpaper_forest' },
  { id: 'wallpaper_space',  name: 'Space Wallpaper',  emoji: '🌌', description: 'The void. But aesthetic.',     cost: 75,  rarity: 'rare', category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, isHousing: true, housingId: 'wallpaper_space' },
  { id: 'wallpaper_cabin',  name: 'Cozy Cabin',       emoji: '🏡', description: 'Warm wood paneling.',          cost: 100, rarity: 'epic', category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, isHousing: true, housingId: 'wallpaper_cabin' },
  { id: 'wallpaper_sunset',    name: 'Sunset Wallpaper',    emoji: '🌅', description: 'Pink and orange dusk gradient.',    cost: 40,  rarity: 'common', category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isHousing: true, housingId: 'wallpaper_sunset' },
  { id: 'wallpaper_ocean',     name: 'Ocean Wallpaper',     emoji: '🌊', description: 'Deep blue gradient with a wave feel.', cost: 60, rarity: 'rare', category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isHousing: true, housingId: 'wallpaper_ocean' },
  { id: 'wallpaper_rainbow',   name: 'Rainbow Wallpaper',   emoji: '🌈', description: 'Animated rainbow gradient.',         cost: 120, rarity: 'epic',  category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isHousing: true, housingId: 'wallpaper_rainbow' },
  { id: 'wallpaper_grid',      name: 'Grid Wallpaper',      emoji: '🔳', description: 'Dev cyberpunk grid lines.',          cost: 50,  rarity: 'common', category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isHousing: true, housingId: 'wallpaper_grid' },
  { id: 'wallpaper_blueprint', name: 'Blueprint Wallpaper', emoji: '📐', description: 'Architect blue with grid lines.',    cost: 90,  rarity: 'rare',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isHousing: true, housingId: 'wallpaper_blueprint' },

  // ── Foreground borders (floor band) ──────────────────────────────────────
  { id: 'border_grass',   name: 'Grass Floor',    emoji: '🌱', description: 'Lush grass carpeting the floor.',      cost: 30,  rarity: 'common', category: ITEM_CATEGORIES.FOREGROUND, stageRequired: 1, isForeground: true, foregroundId: 'border_grass' },
  { id: 'border_sand',    name: 'Sand Floor',     emoji: '🏖️', description: 'Sandy floor with a few shells.',       cost: 35,  rarity: 'common', category: ITEM_CATEGORIES.FOREGROUND, stageRequired: 1, isForeground: true, foregroundId: 'border_sand' },
  { id: 'border_flowers', name: 'Flower Floor',   emoji: '🌸', description: 'Flowers blooming across the floor.',   cost: 60,  rarity: 'rare',   category: ITEM_CATEGORIES.FOREGROUND, stageRequired: 1, isForeground: true, foregroundId: 'border_flowers' },
  { id: 'border_tile',    name: 'Tile Floor',     emoji: '🟦', description: 'Checkerboard tile flooring.',          cost: 40,  rarity: 'common', category: ITEM_CATEGORIES.FOREGROUND, stageRequired: 1, isForeground: true, foregroundId: 'border_tile' },
  { id: 'border_wood',    name: 'Wood Floor',     emoji: '🪵', description: 'Wooden plank flooring.',                cost: 50,  rarity: 'common', category: ITEM_CATEGORIES.FOREGROUND, stageRequired: 1, isForeground: true, foregroundId: 'border_wood' },

  // ── Background props / decorations (wall area) ───────────────────────────
  { id: 'prop_picture',   name: 'Wall Picture',   emoji: '🖼️', description: 'A framed picture for the wall.',      cost: 25,  rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'prop_shelf',     name: 'Wall Shelf',     emoji: '🪜', description: 'A small shelf with knick-knacks.',     cost: 35,  rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'prop_window',    name: 'Faux Window',    emoji: '🪟', description: 'A window with sky behind it.',        cost: 40,  rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'prop_clock',     name: 'Wall Clock',     emoji: '🕰️', description: 'Ticks the hours away.',                cost: 50,  rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'prop_neon_sign', name: 'Neon Sign',      emoji: '💡', description: 'Glowing wall neon — "CODE".',          cost: 80,  rarity: 'rare',   category: ITEM_CATEGORIES.DECORATION, stageRequired: 2, isFurniture: true, allowMultiple: true },
  { id: 'wall_horizontal', name: 'Wall (horizontal)', emoji: '🧱', description: 'A short horizontal wall piece — place several to partition a room.', cost: 60, rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'wall_vertical',   name: 'Wall (vertical)',   emoji: '🧱', description: 'A short vertical wall piece — stack to build dividers.',              cost: 60, rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },

  // ── Housing — Furniture (interactive) ─────────────────────────────────────
  { id: 'food_tray',      name: 'Food Tray',      emoji: '🍽',  description: 'Shows the last item you fed.',     cost: 20,  rarity: 'common', category: ITEM_CATEGORIES.HOUSING, stageRequired: 1, isFurniture: true },
  { id: 'plant',          name: 'House Plant',    emoji: '🪴',  description: 'A bit of greenery.',               cost: 30,  rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'tv',             name: 'TV',             emoji: '📺',  description: 'Cosmetic — turns on at idle.',     cost: 60,  rarity: 'rare',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isFurniture: true },
  { id: 'shower_head',    name: 'Shower Head',    emoji: '🚿',  description: 'Plays during Clean action.',       cost: 70,  rarity: 'rare',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isFurniture: true },
  { id: 'pet_bed',        name: 'Pet Bed',        emoji: '🛏️',  description: 'Pet sleeps here sometimes.',       cost: 80,  rarity: 'rare',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 2, isFurniture: true, passive: { sleepinessTick: -0.5 } },
  { id: 'fancy_bed',      name: 'Fancy Bed',      emoji: '🛏️',  description: 'Reduces sleepiness accumulation.', cost: 80,  rarity: 'rare',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, isHousing: true, housingId: 'fancy_bed', passive: { sleepinessTick: -0.5 } },
  { id: 'bookshelf',      name: 'Bookshelf',      emoji: '📚',  description: '+10% intelligence growth (stacks per copy).', cost: 90, rarity: 'rare', category: ITEM_CATEGORIES.DECORATION, stageRequired: 2, isFurniture: true, allowMultiple: true, passive: { intelligenceMult: 1.10 } },
  { id: 'whiteboard',     name: 'Whiteboard',     emoji: '🪧',  description: '+15% intelligence growth (stacks per copy).', cost: 110, rarity: 'epic', category: ITEM_CATEGORIES.DECORATION, stageRequired: 2, isFurniture: true, allowMultiple: true, passive: { intelligenceMult: 1.15 } },
  { id: 'aquarium',       name: 'Aquarium',       emoji: '🐟',  description: '+1 happiness per tick (stacks per copy).', cost: 120, rarity: 'rare', category: ITEM_CATEGORIES.DECORATION, stageRequired: 2, isFurniture: true, allowMultiple: true, passive: { happiness: 1 } },
  { id: 'table',          name: 'Side Table',     emoji: '🪵',  description: 'A small table — drag the food tray on top.', cost: 45, rarity: 'common', category: ITEM_CATEGORIES.DECORATION, stageRequired: 1, isFurniture: true, allowMultiple: true },
  { id: 'second_monitor', name: 'Second Monitor', emoji: '🖥️',  description: 'Pet watches it. Boredom melts.',   cost: 150, rarity: 'epic',   category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, isHousing: true, housingId: 'second_monitor', passive: { boredom: -2 } },
  { id: 'pet_pc',         name: 'Pet PC',         emoji: '💻',  description: '+20% intelligence growth. Adult only.', cost: 250, rarity: 'epic', category: ITEM_CATEGORIES.HOUSING, stageRequired: 3, achievement: 'adult_pet', isFurniture: true, passive: { intelligenceMult: 1.20 } },

  // ── Instruments ───────────────────────────────────────────────────────────
  { id: 'microphone',     name: 'Microphone',     emoji: '🎤', description: 'Sing a tune.',         cost: 90,  rarity: 'rare', category: ITEM_CATEGORIES.INSTRUMENT, stageRequired: 2, isFurniture: true, isInstrument: true },
  { id: 'guitar',         name: 'Guitar',         emoji: '🎸', description: 'Plays a riff on Play.', cost: 100, rarity: 'epic', category: ITEM_CATEGORIES.INSTRUMENT, stageRequired: 2, isFurniture: true, isInstrument: true },
  { id: 'piano',          name: 'Piano',          emoji: '🎹', description: 'Tickle the ivories.',  cost: 220, rarity: 'epic', category: ITEM_CATEGORIES.INSTRUMENT, stageRequired: 2, isFurniture: true, isInstrument: true },
  { id: 'drum_kit',       name: 'Drum Kit',       emoji: '🥁', description: 'Bang bang bang.',      cost: 240, rarity: 'epic', category: ITEM_CATEGORIES.INSTRUMENT, stageRequired: 2, isFurniture: true, isInstrument: true },
  { id: 'turntable',      name: 'Turntable',      emoji: '🎛️', description: 'Drop a beat.',         cost: 280, rarity: 'epic', category: ITEM_CATEGORIES.INSTRUMENT, stageRequired: 2, isFurniture: true, isInstrument: true },

  // ── Clothing — Head (hatchling+) ──────────────────────────────────────────
  { id: 'baseball_cap',     name: 'Baseball Cap',     emoji: '🧢', description: 'Game day.',                   cost: 10,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'bowler_hat',       name: 'Bowler Hat',       emoji: '🎩', description: 'Dapper.',                     cost: 15,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'sunglasses',       name: 'Sunglasses',       emoji: '🕶️', description: 'Too cool for linting.',        cost: 25,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'party_hat',        name: 'Party Hat',        emoji: '🥳', description: 'Always celebrating.',         cost: 12,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'mustache',         name: 'Mustache',         emoji: '🥸', description: 'Distinguished.',              cost: 18,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'antenna_headband', name: 'Antenna Headband', emoji: '📡', description: 'Boop.',                       cost: 50,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'top_hat',          name: 'Top Hat',          emoji: '🎩', description: 'Iconic.',                     cost: 40,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'wizard_hat',       name: 'Wizard Hat',       emoji: '🧙', description: '+25% intelligence growth.',   cost: 80,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head', passive: { intelligenceMult: 1.25 } },
  { id: 'halloween_mask',   name: 'Halloween Mask',   emoji: '🎃', description: 'Spooky.',                     cost: 60,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'wolf_mask',        name: 'Wolf Mask',        emoji: '🐺', description: 'Howl at the IDE.',            cost: 200, rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'crown',            name: 'Crown',            emoji: '👑', description: '+5 happiness always.',        cost: 150, rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head', passive: { happiness: 5 } },
  { id: 'space_helmet',     name: 'Space Helmet',     emoji: '👨‍🚀', description: 'For the void.',              cost: 250, rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head' },
  { id: 'halo',             name: 'Halo',             emoji: '😇', description: '+1 happiness per tick.',      cost: 500, rarity: 'legendary', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 1, isClothing: true, slot: 'head', passive: { happiness: 1 } },

  // ── Clothing — Body (adolescent+) ─────────────────────────────────────────
  { id: 'plain_tee',     name: 'Plain Tee',     emoji: '👕', description: 'Comfortable.',                cost: 15,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'tie_dye_shirt', name: 'Tie-Dye Shirt', emoji: '🌈', description: 'Far out.',                    cost: 25,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'scarf',         name: 'Scarf',         emoji: '🧣', description: 'Cozy.',                       cost: 30,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'dev_hoodie',    name: 'Dev Hoodie',    emoji: '👕', description: '"I ship therefore I am"',     cost: 40,  rarity: 'common',    category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'formal_vest',   name: 'Formal Vest',   emoji: '🦺', description: 'Sharp.',                      cost: 70,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'cape',          name: 'Cape',          emoji: '🦸', description: '+5% evolution score.',        cost: 80,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body', passive: { evolutionBonus: 0.05 } },
  { id: 'tuxedo_top',    name: 'Tuxedo Top',    emoji: '🤵', description: 'Black tie.',                  cost: 90,  rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'lab_coat',      name: 'Lab Coat',      emoji: '🥼', description: '+20% intelligence growth.',   cost: 110, rarity: 'rare',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body', passive: { intelligenceMult: 1.20 } },
  { id: 'pirate_vest',   name: 'Pirate Vest',   emoji: '🏴‍☠️', description: 'Yarrr.',                    cost: 180, rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },
  { id: 'royal_robe',    name: 'Royal Robe',    emoji: '👘', description: '+3 happiness per tick.',      cost: 220, rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body', passive: { happiness: 3 } },
  { id: 'jetpack',       name: 'Jetpack',       emoji: '🚀', description: 'Whoooosh.',                   cost: 600, rarity: 'legendary', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'body' },

  // ── Clothing — Arms (adolescent+) ─────────────────────────────────────────
  { id: 'mittens',        name: 'Mittens',        emoji: '🧤', description: 'Cute.',                cost: 12,  rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },
  { id: 'bracelets',      name: 'Bracelets',      emoji: '📿', description: 'Flair.',               cost: 18,  rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },
  { id: 'gloves',         name: 'Gloves',         emoji: '🧤', description: 'Practical.',           cost: 20,  rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },
  { id: 'wrist_watch',    name: 'Wrist Watch',    emoji: '⌚', description: 'Always on time.',      cost: 75,  rarity: 'rare',   category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },
  { id: 'boxing_gloves',  name: 'Boxing Gloves',  emoji: '🥊', description: 'Float like a butterfly.', cost: 95, rarity: 'rare', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },
  { id: 'gauntlets',      name: 'Gauntlets',      emoji: '🛡️', description: 'Armored up.',          cost: 200, rarity: 'epic',   category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'arms' },

  // ── Clothing — Feet (adolescent+) ─────────────────────────────────────────
  { id: 'socks',          name: 'Socks',          emoji: '🧦', description: 'The basics.',          cost: 8,   rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet' },
  { id: 'sneakers',       name: 'Sneakers',       emoji: '👟', description: 'For running.',         cost: 30,  rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet' },
  { id: 'rain_boots',     name: 'Rain Boots',     emoji: '🥾', description: 'Splash splash.',       cost: 35,  rarity: 'common', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet' },
  { id: 'ankle_monitor',  name: 'Ankle Monitor',  emoji: '🦶', description: 'For… reasons.',        cost: 50,  rarity: 'rare',   category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet' },
  { id: 'formal_shoes',   name: 'Formal Shoes',   emoji: '👞', description: 'Polished.',            cost: 65,  rarity: 'rare',   category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet' },
  { id: 'winged_sandals', name: 'Winged Sandals', emoji: '🪽', description: '+1 happiness per tick.', cost: 240, rarity: 'epic', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, slot: 'feet', passive: { happiness: 1 } },

  // ── Outfit bundles ────────────────────────────────────────────────────────
  { id: 'wizard_set',    name: 'Wizard Set',     emoji: '🧙‍♂️', description: 'Hat + robe + gloves + sandals.', cost: 400,  rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, isBundle: true, bundle: ['wizard_hat', 'royal_robe', 'gloves', 'winged_sandals'] },
  { id: 'tuxedo_set',    name: 'Tuxedo Set',     emoji: '🤵', description: 'Top hat + tux + gloves + shoes.',  cost: 350,  rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, isBundle: true, bundle: ['top_hat', 'tuxedo_top', 'gloves', 'formal_shoes'] },
  { id: 'pirate_set',    name: 'Pirate Set',     emoji: '🏴‍☠️', description: 'Mask + vest + gloves + boots.',  cost: 380,  rarity: 'epic',      category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, isBundle: true, bundle: ['halloween_mask', 'pirate_vest', 'gloves', 'rain_boots'] },
  { id: 'space_explorer',name: 'Space Explorer', emoji: '🚀', description: 'Full astronaut kit.',              cost: 1500, rarity: 'legendary', category: ITEM_CATEGORIES.CLOTHING, stageRequired: 2, isClothing: true, isBundle: true, achievement: 'token_2m', bundle: ['space_helmet', 'jetpack', 'gauntlets', 'winged_sandals'] },

  // ── Game unlocks ──────────────────────────────────────────────────────────
  { id: 'game_2048',             name: '2048',             emoji: '🔢', description: 'Unlocks the 2048 mini-game.',           cost: 150, rarity: 'rare',      category: ITEM_CATEGORIES.GAME_UNLOCK, stageRequired: 2, gameId: '2048' },
  { id: 'game_breakout',         name: 'Breakout',         emoji: '🧱', description: 'Unlocks Breakout.',                     cost: 200, rarity: 'rare',      category: ITEM_CATEGORIES.GAME_UNLOCK, stageRequired: 2, gameId: 'breakout' },
  { id: 'game_chess',            name: 'Chess',            emoji: '♟️', description: 'Unlocks Chess vs your pet.',            cost: 800, rarity: 'legendary', category: ITEM_CATEGORIES.GAME_UNLOCK, stageRequired: 2, gameId: 'chess' },
  { id: 'game_checkers',         name: 'Checkers',         emoji: '🔴', description: 'Unlocks Checkers vs your pet.',         cost: 350, rarity: 'rare',      category: ITEM_CATEGORIES.GAME_UNLOCK, stageRequired: 2, gameId: 'checkers' },
  { id: 'game_battleship',       name: 'Battleship',       emoji: '🚢', description: 'Place your fleet — sink the pet first.', cost: 500, rarity: 'epic',      category: ITEM_CATEGORIES.GAME_UNLOCK, stageRequired: 2, gameId: 'battleship' },
];

// Helper: get items available for a given stage
export function getAvailableItems(stage) {
  return SHOP_ITEMS.filter(item => item.stageRequired <= stage);
}

// Helper: get items by category
export function getItemsByCategory(category, stage = 0) {
  return SHOP_ITEMS.filter(item => item.category === category && item.stageRequired <= stage);
}

export function getItemById(id) {
  return SHOP_ITEMS.find(item => item.id === id);
}
