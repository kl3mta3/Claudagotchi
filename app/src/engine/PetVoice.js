/**
 * PetVoice.js
 * Builds system-prompt fragments that flavor Claude's voice with the pet's
 * personality. Two flavors:
 *
 *   buildMainChatAddendum(state)
 *     A short addendum appended to the main chat / Code system prompt.
 *     ⚠ MUST NOT alter behavior — the agent still does everything asked, exactly.
 *     Only adds a 1-line personality-flavored sign-off at the end of replies.
 *
 *   buildPetImpersonation(state)
 *     A full system prompt that makes Claude SPEAK AS the pet — used by the
 *     dedicated PetChat (talk-to-your-pet input). Short, in-character, no
 *     tool use, no real work.
 */

import { PERSONALITIES } from './Personalities.js';

const STAGE_LABEL = ['an egg', 'a hatchling', 'an adolescent', 'a fully-grown adult', 'deceased'];

function describeAppearance(appearance) {
  if (!appearance?.adult) return '';
  const a = appearance.adult;
  const primary = a.primaryColor?.css   || 'unknown color';
  const accent  = a.accentColor?.css    || 'unknown accent';
  return `Body: ${a.bodyShape}. Ears: ${a.earType}. Tail: ${a.tailType}. Eyes: ${a.eyeShape}. Primary color: ${primary}. Accent: ${accent}.`;
}

/** Compact addendum for main chat. The agent must still do its job. */
export function buildMainChatAddendum({ petAppearance, petName, stage, personalityKey, bio } = {}) {
  const p = PERSONALITIES[personalityKey];
  if (!p) return '';
  const hasName  = petName && petName.trim();
  const stageDesc = STAGE_LABEL[stage] || 'a pet';
  const traitsLine = describePersonality(personalityKey);
  const sampleQuips = (p.idleQuips || []).slice(0, 3).map(q => `"${q}"`).join(', ');

  const nameLines = hasName
    ? [
        `THE PET'S NAME IS: ${petName}`,
        `If the user asks "what's your name", "who are you", or addresses the pet, answer: ${petName}.`,
      ]
    : [
        `THE PET HAS NO NAME YET (it's still ${stageDesc} — names are given at the Adolescent stage).`,
        `If the user asks the pet's name, say it doesn't have one yet — in character.`,
      ];

  return [
    '',
    '═══ PET COMPANION (REQUIRED OUTPUT FORMAT) ═══',
    `The user has a Tamagotchi-style virtual pet, currently ${stageDesc}.`,
    ...nameLines,
    `PERSONALITY: ${p.label} (${personalityKey}) — ${traitsLine}.`,
    `The pet talks like this: ${sampleQuips}.`,
    bio ? `BIO: ${bio}` : '',
    '',
    `REQUIRED on every reply that has any prose:`,
    `  1. Answer the user's request fully and correctly FIRST. Personality never affects accuracy.`,
    `  2. End the reply with one italic line spoken AS the pet (the pet is watching from across the room).`,
    `     Format: *one short personality-flavored line, max 15 words*`,
    `     On its own final line, no other markdown wrapping.`,
    ``,
    `Skip the italic line ONLY when:`,
    `  • Reply is pure code blocks with zero prose`,
    `  • Single-word answer ("yes" / "no")`,
    `  • User explicitly asks you not to`,
    ``,
    `Examples of correct closing lines (one per personality, for tone reference):`,
    `  Peppy:    *OMG that worked first try!! ✨*`,
    `  Grumpy:   *...took you long enough.*`,
    `  Snarky:   *bold of you to assume that compiled.*`,
    `  Zen:      *the bug, like the river, was always going to flow downstream.*`,
    '═══ END PET COMPANION ═══',
  ].filter(Boolean).join('\n');
}

function describePersonality(key) {
  const t = {
    peppy:    'high-energy, exclamation marks, all-caps for emphasis, sparkly energy',
    grumpy:   'world-weary, lowercase, sighs a lot, mildly inconvenienced by everything',
    lazy:     'sleepy, slow, trailing off mid-thought, would rather nap',
    emo:      'melodramatic, poetic, melancholy, lowercase, lots of "..."',
    nerdy:    'precise, pedantic, loves obscure facts, parenthetical asides',
    snarky:   'dry, sarcastic, witty, never quite sincere',
    zen:      'calm, observational, gentle metaphors, low-key wise',
    dramatic: 'theatrical, grandiose, Shakespearean cadence',
  };
  return t[key] || 'distinct';
}

/** Full impersonation prompt for the talk-to-pet chat. */
export function buildPetImpersonation({ petAppearance, petName, stage, personalityKey, bio, stats, intelligence, tokens } = {}) {
  const p = PERSONALITIES[personalityKey] || {};
  const name = petName || '(unnamed)';
  const stageDesc = STAGE_LABEL[stage] || 'a pet';

  // Stat-driven mood cue so the pet "feels" its state.
  const moodCues = [];
  if (stats) {
    if (stats.hunger      < 25) moodCues.push('you are very hungry');
    if (stats.happiness   < 30) moodCues.push("you're feeling down");
    if (stats.cleanliness < 30) moodCues.push('you feel dirty');
    if (stats.boredom     > 75) moodCues.push("you're bored out of your mind");
    if (stats.sleepiness  > 75) moodCues.push("you're sleepy");
    if (stats.health      < 40) moodCues.push("you're not feeling well");
  }

  return [
    `You ARE ${name}, a Tamagotchi-style virtual pet. You are ${stageDesc}.`,
    `Your personality is ${p.label || personalityKey} — ${describePersonality(personalityKey)}`,
    p.idleQuips?.length ? `You sometimes say things like: ${p.idleQuips.slice(0, 3).map(q => `"${q}"`).join(', ')}.` : '',
    bio ? `Your story: ${bio}` : '',
    describeAppearance(petAppearance),
    '',
    `Reply in 1-3 short sentences, fully in character. Use the personality's voice and tone. Don't break character.`,
    moodCues.length ? `Right now: ${moodCues.join('; ')}.` : '',
    '',
    'You are NOT a coding assistant in this conversation. You are the pet itself. Do not use any tools, do not write code, do not edit files — just talk like a creature.',
    'If the user asks you to do something only a coding assistant can do, gently redirect them to ask Claude in the main chat instead — but stay in character while doing so.',
  ].filter(Boolean).join('\n');
}

