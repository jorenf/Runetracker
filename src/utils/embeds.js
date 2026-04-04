/**
 * src/utils/embeds.js
 * Compact ScapeBot-style Discord embeds.
 *
 * Design rules (matching the screenshot reference):
 *   – No embed title; only a coloured left border + description.
 *   – One natural-language line per change.
 *   – OSRS emoji at the end of each line.
 *   – Multiple changes of the same type are grouped in one embed.
 */

import { EmbedBuilder } from 'discord.js';

// ---------------------------------------------------------------------------
// Colour palette (OSRS-themed)
// ---------------------------------------------------------------------------
export const COLORS = {
  skill:       0xffb347, // warm orange  – level ups
  boss:        0xc0392b, // deep red     – boss kills
  achievement: 0xf1c40f, // gold         – achievements
  clue:        0x27ae60, // deep green   – clue scrolls
  nameChange:  0x3498db, // blue         – username change
  info:        0x95a5a6, // grey         – status / info
};

// ---------------------------------------------------------------------------
// OSRS skill → emoji map
// ---------------------------------------------------------------------------
const SKILL_EMOJI = {
  overall:      '🌟',
  attack:       '⚔️',
  defence:      '🛡️',
  strength:     '💪',
  hitpoints:    '❤️',
  ranged:       '🏹',
  prayer:       '✨',
  magic:        '🔮',
  cooking:      '🍳',
  woodcutting:  '🪓',
  fletching:    '🪃',
  fishing:      '🎣',
  firemaking:   '🔥',
  crafting:     '🧶',
  smithing:     '🔨',
  mining:       '⛏️',
  herblore:     '🌿',
  agility:      '🏃',
  thieving:     '🗝️',
  slayer:       '💀',
  farming:      '🌾',
  runecrafting: '🔯',
  hunter:       '🦊',
  construction: '🏗️',
  sailing:      '⛵',
};

// ---------------------------------------------------------------------------
// Clue scroll tier → emoji map
// ---------------------------------------------------------------------------
const CLUE_EMOJI = {
  clue_scrolls_all:      '📜',
  clue_scrolls_beginner: '📜',
  clue_scrolls_easy:     '🟢',
  clue_scrolls_medium:   '🟡',
  clue_scrolls_hard:     '🔴',
  clue_scrolls_elite:    '⭐',
  clue_scrolls_master:   '👑',
};

// Clue tier display names (strip the "clue_scrolls_" prefix and capitalise)
const CLUE_TIER_NAME = {
  clue_scrolls_all:      'All',
  clue_scrolls_beginner: 'Beginner',
  clue_scrolls_easy:     'Easy',
  clue_scrolls_medium:   'Medium',
  clue_scrolls_hard:     'Hard',
  clue_scrolls_elite:    'Elite',
  clue_scrolls_master:   'Master',
};

// ---------------------------------------------------------------------------
// Notable boss → emoji map (unmapped bosses fall back to ⚔️)
// ---------------------------------------------------------------------------
const BOSS_EMOJI = {
  zulrah:               '🐍',
  vorkath:              '🐉',
  cerberus:             '🐕',
  barrows_chests:       '⚰️',
  wintertodt:           '❄️',
  theatre_of_blood:     '🩸',
  theatre_of_blood_hard_mode: '🩸',
  tombs_of_amascut:     '🏺',
  tombs_of_amascut_expert: '🏺',
  the_gauntlet:         '⚔️',
  corrupted_gauntlet:   '💜',
  nex:                  '👼',
  phantom_muspah:       '👻',
  the_leviathan:        '🌊',
  the_whisperer:        '🌑',
  duke_sucellus:        '🧊',
  vardorvis:            '🌿',
  scurrius:             '🐀',
  lunar_chests:         '🌙',
  sol_heredit:          '👑',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number with thousands separators. */
export function formatNumber(n) {
  if (n == null || n < 0) return '—';
  return Number(n).toLocaleString('en-GB');
}

/** snake_case → Title Case */
export function formatMetricName(key) {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Return the emoji for a skill key, falling back to 📊. */
function skillEmoji(key) {
  return SKILL_EMOJI[key] ?? '📊';
}

/** Return the emoji for a boss key, falling back to ⚔️. */
function bossEmoji(key) {
  return BOSS_EMOJI[key] ?? '⚔️';
}

/**
 * Shared helper: build a plain-description embed with a coloured left border.
 * No title, no fields – just the lines of text.
 */
function compactEmbed(color, lines) {
  return new EmbedBuilder()
    .setColor(color)
    .setDescription(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Public embed builders
// ---------------------------------------------------------------------------

/**
 * Level-up notifications.
 * One line per skill: "**Player** has gained **3** levels in **Magic** and is now level **70** 🔮"
 *
 * @param {string} displayName
 * @param {Array<{skill, oldLevel, newLevel, oldXp, newXp}>} changes
 */
export function buildLevelEmbed(displayName, changes) {
  const lines = changes.map(c => {
    const gained = c.newLevel - c.oldLevel;
    const plural = gained === 1 ? 'level' : 'levels';
    const skill  = formatMetricName(c.skill);
    const emoji  = skillEmoji(c.skill);
    return `**${displayName}** has gained **${gained}** ${plural} in **${skill}** and is now level **${c.newLevel}** ${emoji}`;
  });
  return compactEmbed(COLORS.skill, lines);
}

/**
 * Boss kill notifications.
 * "**Player** has defeated **Zulrah** 5 more times for a total of **1,337** 🐍"
 *
 * @param {string} displayName
 * @param {Array<{boss, oldKills, newKills}>} changes
 */
export function buildBossEmbed(displayName, changes) {
  const lines = changes.map(c => {
    const boss   = formatMetricName(c.boss);
    const gained = c.newKills - c.oldKills;
    const total  = formatNumber(c.newKills);
    const emoji  = bossEmoji(c.boss);
    const times  = gained === 1 ? 'again' : `**${gained}** more times`;
    return `**${displayName}** has defeated **${boss}** ${times} for a total of **${total}** ${emoji}`;
  });
  return compactEmbed(COLORS.boss, lines);
}

/**
 * Achievement notifications.
 * "**Player** has unlocked: **5,000 Zulrah kills** 🏆"
 *
 * @param {string} displayName
 * @param {Array<{name, metric, measure, threshold}>} achievements
 */
export function buildAchievementEmbed(displayName, achievements) {
  const lines = achievements.map(a => {
    return `**${displayName}** has unlocked: **${a.name}** 🏆`;
  });
  return compactEmbed(COLORS.achievement, lines);
}

/**
 * Clue scroll notifications.
 * "**Player** has completed **2** more **Easy** clues for a total of **79** 🟢"
 *
 * @param {string} displayName
 * @param {Array<{tier, oldScore, newScore}>} changes
 */
export function buildClueEmbed(displayName, changes) {
  const lines = changes.map(c => {
    const tier   = CLUE_TIER_NAME[c.tier] ?? formatMetricName(c.tier);
    const gained = c.newScore - c.oldScore;
    const total  = formatNumber(c.newScore);
    const emoji  = CLUE_EMOJI[c.tier] ?? '📜';
    const times  = gained === 1 ? 'another' : `**${gained}** more`;
    const noun   = gained === 1 ? 'clue' : 'clues';
    return `**${displayName}** has completed ${times} **${tier}** ${noun} for a total of **${total}** ${emoji}`;
  });
  return compactEmbed(COLORS.clue, lines);
}

/**
 * Username change notification.
 * Compact single-line format with left border.
 */
export function buildNameChangeEmbed(oldName, newName) {
  return compactEmbed(COLORS.nameChange, [
    `✏️ **${oldName}** has changed their name to **${newName}** – tracking updated automatically.`,
  ]);
}
