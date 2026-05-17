/**
 * AchievementEngine.js
 * Catalog of unlockable achievements + a pure check function.
 *
 * State shape expected by `check`/`checkAll`:
 * {
 *   totalTokensEarned: number,
 *   lastActiveDates:   string[]   // 'YYYY-MM-DD' entries, latest last
 *   longestSessionMinutes: number,
 *   totalTurns:        number,
 *   projectDepthMap:   { [folder]: number },
 *   hasReachedAdult:   boolean,
 * }
 */

function consecutiveStreak(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort(); // ascending YYYY-MM-DD
  let streak = 1;
  let best = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00Z');
    const curr = new Date(sorted[i]     + 'T00:00:00Z');
    const diff = Math.round((curr - prev) / 86_400_000);
    if (diff === 1) {
      streak++;
      if (streak > best) best = streak;
    } else if (diff > 1) {
      streak = 1;
    }
  }
  return best;
}

export const ACHIEVEMENTS = [
  { id: 'token_1m',   name: '1M Tokens',   hint: 'Earn 1,000,000 tokens',     check: s => (s.totalTokensEarned ?? 0) >= 1_000_000 },
  { id: 'token_2m',   name: '2M Tokens',   hint: 'Earn 2,000,000 tokens',     check: s => (s.totalTokensEarned ?? 0) >= 2_000_000 },
  { id: 'token_5m',   name: '5M Tokens',   hint: 'Earn 5,000,000 tokens',     check: s => (s.totalTokensEarned ?? 0) >= 5_000_000 },
  { id: 'streak_3',   name: '3-Day Streak',  hint: 'Use Claudigotchi 3 days in a row',  check: s => consecutiveStreak(s.lastActiveDates) >= 3 },
  { id: 'streak_7',   name: '7-Day Streak',  hint: 'Use Claudigotchi 7 days in a row',  check: s => consecutiveStreak(s.lastActiveDates) >= 7 },
  { id: 'streak_30',  name: '30-Day Streak', hint: 'Use Claudigotchi 30 days in a row', check: s => consecutiveStreak(s.lastActiveDates) >= 30 },
  { id: 'marathon_3h',name: 'Marathon 3h',   hint: '3 hours in a single Code session',  check: s => (s.longestSessionMinutes ?? 0) >= 180 },
  { id: 'marathon_6h',name: 'Marathon 6h',   hint: '6 hours in a single Code session',  check: s => (s.longestSessionMinutes ?? 0) >= 360 },
  { id: 'centurion',  name: 'Centurion',     hint: 'Finish 100 turns',                  check: s => (s.totalTurns ?? 0) >= 100 },
  { id: 'polyglot',   name: 'Polyglot',      hint: 'Use Claude in 5+ project folders',  check: s => Object.keys(s.projectDepthMap ?? {}).length >= 5 },
  { id: 'adult_pet',  name: 'Grew Up',       hint: 'Raise a pet to Adult',              check: s => !!s.hasReachedAdult },
];

export function checkAll(state = {}) {
  const out = new Set();
  for (const a of ACHIEVEMENTS) {
    try { if (a.check(state)) out.add(a.id); } catch { /* ignore */ }
  }
  return out;
}

export function getAchievement(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}
