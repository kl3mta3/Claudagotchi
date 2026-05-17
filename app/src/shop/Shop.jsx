import { useState } from 'react';
import { SHOP_ITEMS, ITEM_CATEGORIES } from './ShopItems.js';
import { rarityOf, RARITIES, RARITY_ORDER } from './Rarity.js';
import { getAchievement } from '../engine/AchievementEngine.js';

const TABS = [
  { key: ITEM_CATEGORIES.FOOD,        label: 'Food'        },
  { key: ITEM_CATEGORIES.SNACK,       label: 'Snacks'      },
  { key: ITEM_CATEGORIES.TOY,         label: 'Toys'        },
  { key: ITEM_CATEGORIES.CONSUMABLE,  label: 'Consumables' },
  { key: ITEM_CATEGORIES.HOUSING,     label: 'Housing'     },
  { key: ITEM_CATEGORIES.FOREGROUND,  label: 'Foregrounds' },
  { key: ITEM_CATEGORIES.DECORATION,  label: 'Decorations' },
  { key: ITEM_CATEGORIES.INSTRUMENT,  label: 'Instruments' },
  { key: ITEM_CATEGORIES.CLOTHING,    label: 'Clothing'    },
  { key: ITEM_CATEGORIES.GAME_UNLOCK, label: 'Games'       },
];

// Categories where the same item can be repurchased every time (consumed on use).
const REBUYABLE_CATS = new Set([
  ITEM_CATEGORIES.FOOD,
  ITEM_CATEGORIES.SNACK,
  ITEM_CATEGORIES.CONSUMABLE,
]);

/** Compute the per-item state shown to the user.
 *  Returns one of:
 *    { kind: 'buy' }                     — first-time purchase
 *    { kind: 'rebuy' }                   — consumable, already owned but can buy more
 *    { kind: 'equipped' }                — clothing currently worn (no action)
 *    { kind: 'equip' }                   — clothing owned but not in active slot
 *    { kind: 'active'  }                 — wallpaper currently applied
 *    { kind: 'apply' }                   — wallpaper owned but a different one is active
 *    { kind: 'owned'  }                  — furniture / toy / instrument / game already in inventory
 */
function computeOwnership(item, { inventory, clothing, housing, foreground, unlockedGames }) {
  const id = item.id;
  // Multi-instance items use baseId since the per-instance ids look like `id#uid`.
  const matches = item.allowMultiple
    ? inventory.filter(i => i.baseId === id)
    : inventory.filter(i => i.id === id);
  const entry = matches[0];
  const owned = matches.length > 0;
  const placed = !!entry && entry.placed !== false;

  // Multi-instance items (decorations marked allowMultiple): always rebuy.
  if (item.allowMultiple) {
    return { kind: matches.length === 0 ? 'buy' : 'rebuy', count: matches.length };
  }

  if (REBUYABLE_CATS.has(item.category)) {
    return owned ? { kind: 'rebuy' } : { kind: 'buy' };
  }
  if (item.category === ITEM_CATEGORIES.CLOTHING) {
    if (!owned) return { kind: 'buy' };
    const equipped = clothing.some(c => c.id === id);
    return equipped ? { kind: 'equipped' } : { kind: 'equip' };
  }
  if (item.category === ITEM_CATEGORIES.HOUSING) {
    const isWallpaper = /^wallpaper_/.test(id) || id === 'cozyCabin';
    if (isWallpaper) {
      if (!owned) return { kind: 'buy' };
      return housing === id ? { kind: 'active' } : { kind: 'apply' };
    }
    if (!owned) return { kind: 'buy' };
    return placed ? { kind: 'placed' } : { kind: 'unplaced' };
  }
  if (item.category === ITEM_CATEGORIES.FOREGROUND) {
    if (!owned) return { kind: 'buy' };
    const activeFg = foreground;
    const myFg = item.foregroundId || item.id;
    return activeFg === myFg ? { kind: 'active' } : { kind: 'apply' };
  }
  if (item.category === ITEM_CATEGORIES.GAME_UNLOCK) {
    return (unlockedGames || []).includes(id) ? { kind: 'owned' } : { kind: 'buy' };
  }
  // Toys / instruments / fallback — furniture-style placement
  if (!owned) return { kind: 'buy' };
  return placed ? { kind: 'placed' } : { kind: 'unplaced' };
}

export function Shop({
  open, onClose, tokens, stage,
  onBuy, onEquip, onUnequip,
  onApplyHousing, onResetHousing,
  onTogglePlaced,
  unlockedAchievements = [],
  inventory = [], clothing = [], housing = 'default', foreground = null, unlockedGames = [],
}) {
  const [tab, setTab]                   = useState(ITEM_CATEGORIES.FOOD);
  const [rarityFilter, setRarityFilter] = useState('all');
  if (!open) return null;

  const unlockedSet = new Set(unlockedAchievements);

  let items = SHOP_ITEMS.filter(it => it.category === tab);
  if (rarityFilter !== 'all') items = items.filter(it => (it.rarity || 'common') === rarityFilter);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>🛍️ Shop</h2>
          <div style={S.tokens}>🪙 {tokens}</div>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>

        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.key}
              style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div style={S.rarityRow}>
          <button
            style={{ ...S.rarityPill, ...(rarityFilter === 'all' ? S.rarityActive : {}) }}
            onClick={() => setRarityFilter('all')}
          >All</button>
          {RARITY_ORDER.map(r => (
            <button key={r}
              style={{
                ...S.rarityPill,
                borderColor: RARITIES[r].color,
                color: rarityFilter === r ? '#fff' : RARITIES[r].color,
                background: rarityFilter === r ? RARITIES[r].color : 'transparent',
              }}
              onClick={() => setRarityFilter(r)}
            >{RARITIES[r].label}</button>
          ))}
        </div>

        <div style={S.grid}>
          {items.length === 0 && <div style={S.empty}>nothing in this category</div>}
          {items.map(item => {
            const r = rarityOf(item);
            const stageLocked = (item.stageRequired ?? 0) > stage;
            const achLocked = !!item.achievement && !unlockedSet.has(item.achievement);
            const ach = item.achievement ? getAchievement(item.achievement) : null;
            const own = computeOwnership(item, { inventory, clothing, housing, foreground, unlockedGames });

            // Action handler dispatches by ownership state.
            let label, action, buttonStyle, disabled;
            const canBuy = !stageLocked && !achLocked && tokens >= item.cost;
            switch (own.kind) {
              case 'equipped':
                label = '✓ Equipped (unequip)';
                action = () => onUnequip?.(item);
                disabled = false;
                buttonStyle = { ...S.buy, background: '#1a3a2a', color: '#7fffd4', cursor: 'pointer' };
                break;
              case 'equip':
                label = 'Equip';
                action = () => onEquip?.(item);
                disabled = stageLocked;
                buttonStyle = { ...S.buy, background: r.color, color: '#fff' };
                break;
              case 'active':
                label = '✓ Active (remove)';
                action = () => onResetHousing?.(item);
                disabled = false;
                buttonStyle = { ...S.buy, background: '#1a3a2a', color: '#7fffd4', cursor: 'pointer' };
                break;
              case 'apply':
                label = 'Apply';
                action = () => onApplyHousing?.(item);
                disabled = stageLocked;
                buttonStyle = { ...S.buy, background: r.color, color: '#fff' };
                break;
              case 'placed':
                label = '✓ Placed (remove)';
                action = () => onTogglePlaced?.(item, false);
                disabled = false;
                buttonStyle = { ...S.buy, background: '#1a3a2a', color: '#7fffd4', cursor: 'pointer' };
                break;
              case 'unplaced':
                label = 'Place';
                action = () => onTogglePlaced?.(item, true);
                disabled = false;
                buttonStyle = { ...S.buy, background: r.color, color: '#fff' };
                break;
              case 'owned':
                label = '✓ Owned';
                action = null;
                disabled = true;
                buttonStyle = { ...S.buy, background: '#2a2a3a', color: '#888', cursor: 'default' };
                break;
              case 'rebuy':
                label = `🪙 ${item.cost}${own.count ? ` (own ${own.count})` : ' (buy more)'}`;
                action = () => onBuy?.(item);
                disabled = !canBuy;
                buttonStyle = { ...S.buy, background: r.color, opacity: disabled ? 0.4 : 1 };
                break;
              case 'buy':
              default:
                label = `🪙 ${item.cost}`;
                action = () => onBuy?.(item);
                disabled = !canBuy;
                buttonStyle = { ...S.buy, background: r.color, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' };
            }

            const isOwned = ['equipped','equip','active','apply','placed','unplaced','owned','rebuy'].includes(own.kind);

            return (
              <div key={item.id} style={{
                ...S.card,
                borderColor: r.color,
                boxShadow: `0 0 0 1px ${r.color}33`,
                ...(isOwned && own.kind !== 'rebuy' ? S.cardOwned : {}),
              }}>
                <div style={{ ...S.rarityBadge, color: r.color, borderColor: r.color }}>{r.label}</div>
                {isOwned && own.kind !== 'rebuy' && (
                  <div style={S.ownedBadge}>OWNED</div>
                )}
                <div style={S.emoji}>{item.emoji || '📦'}</div>
                <div style={S.name}>{item.name}</div>
                <div style={S.desc}>{item.description}</div>
                {stageLocked && <div style={S.lock}>🔒 needs stage {item.stageRequired}</div>}
                {achLocked   && <div style={S.lock}>🔒 {ach ? ach.hint : item.achievement}</div>}
                <button
                  disabled={disabled}
                  onClick={action || undefined}
                  style={buttonStyle}
                >{label}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel:   { width: 820, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#111', border: '1px solid #222', borderRadius: 14, overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #222' },
  title:   { fontSize: 16, color: '#eee', margin: 0, flex: 1 },
  tokens:  { fontSize: 14, color: '#ffd166', fontFamily: 'Consolas, monospace' },
  close:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, marginLeft: 10 },
  tabs:    { display: 'flex', gap: 4, padding: '8px 18px', borderBottom: '1px solid #1a1a22', flexWrap: 'wrap' },
  tab:     { padding: '5px 12px', background: '#15151b', border: '1px solid #222', color: '#999', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  tabActive: { background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  rarityRow:   { display: 'flex', gap: 6, padding: '8px 18px', borderBottom: '1px solid #1a1a22' },
  rarityPill:  { padding: '3px 10px', background: 'transparent', border: '1px solid #2a2a2a', color: '#888', borderRadius: 999, cursor: 'pointer', fontSize: 10, fontWeight: 600 },
  rarityActive:{ background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' },
  grid:    { flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, padding: 16 },
  empty:   { padding: 30, color: '#444', fontSize: 12, gridColumn: '1 / -1', textAlign: 'center' },
  card:    { position: 'relative', background: '#0e0e14', border: '2px solid #1f1f28', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  rarityBadge: { position: 'absolute', top: 4, right: 6, fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '1px 5px', border: '1px solid', borderRadius: 3 },
  emoji:   { fontSize: 30, textAlign: 'center' },
  name:    { fontSize: 12, fontWeight: 600, color: '#ddd', textAlign: 'center' },
  desc:    { fontSize: 10, color: '#888', textAlign: 'center', lineHeight: 1.4, flex: 1 },
  lock:    { fontSize: 10, color: '#e74c3c', textAlign: 'center' },
  buy:     { padding: '6px 10px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cardOwned: { background: '#0f1612' },
  ownedBadge:{ position: 'absolute', top: 4, left: 6, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: '#7fffd4', background: '#0a0a0f', border: '1px solid #2a3a2a', padding: '1px 5px', borderRadius: 3 },
};
