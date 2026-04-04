/**
 * src/utils/embeds.js
 * Compact ScapeBot-style Discord embeds with OSRS Wiki thumbnails.
 */

import { EmbedBuilder } from 'discord.js';
import {
  getSkillIcon, getBossIcon, getClueIcon, getXpBarIcon,
} from './wikicons.js';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------
export const COLORS = {
  skill:       0xffb347,
  milestone:   0xf1c40f, // gold  – 99s, total level, KC milestones
  boss:        0xc0392b,
  achievement: 0xe67e22,
  clue:        0x27ae60,
  nameChange:  0x3498db,
  weekly:      0x9b59b6, // purple – weekly leaderboard
  info:        0x95a5a6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatNumber(n) {
  if (n == null || n < 0) return '—';
  return Number(n).toLocaleString('en-GB');
}

/** Format large XP values as "1.2m", "450k", "12,345". */
export function formatXp(xp) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}m`;
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}k`;
  return formatNumber(xp);
}

export function formatMetricName(key) {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const CLUE_TIER = {
  clue_scrolls_all:      'All',
  clue_scrolls_beginner: 'Beginner',
  clue_scrolls_easy:     'Easy',
  clue_scrolls_medium:   'Medium',
  clue_scrolls_hard:     'Hard',
  clue_scrolls_elite:    'Elite',
  clue_scrolls_master:   'Master',
};

/** Base embed – coloured left border + optional thumbnail, no title. */
function base(color, lines, thumbnailUrl) {
  const e = new EmbedBuilder()
    .setColor(color)
    .setDescription(lines.join('\n'));
  if (thumbnailUrl) e.setThumbnail(thumbnailUrl);
  return e;
}

// ---------------------------------------------------------------------------
// Regular notifications
// ---------------------------------------------------------------------------

/**
 * Level-up embed.
 * Uses the skill icon of the first (highest-gain) skill as thumbnail.
 */
export function buildLevelEmbed(displayName, changes) {
  // Sort by levels gained desc so the biggest gain drives the thumbnail.
  const sorted = [...changes].sort((a, b) => (b.newLevel - b.oldLevel) - (a.newLevel - a.oldLevel));
  const lines = sorted.map(c => {
    const gained = c.newLevel - c.oldLevel;
    const plural = gained === 1 ? 'level' : 'levels';
    return `**${displayName}** has gained **${gained}** ${plural} in **${formatMetricName(c.skill)}** and is now level **${c.newLevel}**`;
  });
  return base(COLORS.skill, lines, getSkillIcon(sorted[0].skill));
}

/**
 * Boss kill embed.
 */
export function buildBossEmbed(displayName, changes) {
  const lines = changes.map(c => {
    const boss   = formatMetricName(c.boss);
    const gained = c.newKills - c.oldKills;
    const times  = gained === 1 ? 'again' : `**${gained}** more times`;
    return `**${displayName}** has defeated **${boss}** ${times} for a total of **${formatNumber(c.newKills)}**`;
  });
  return base(COLORS.boss, lines, getBossIcon(changes[0].boss));
}

/**
 * Achievement embed.
 */
export function buildAchievementEmbed(displayName, achievements) {
  const lines = achievements.map(a => `**${displayName}** has unlocked: **${a.name}**`);
  return base(COLORS.achievement, lines);
}

/**
 * Clue scroll embed.
 */
export function buildClueEmbed(displayName, changes) {
  const lines = changes.map(c => {
    const tier   = CLUE_TIER[c.tier] ?? formatMetricName(c.tier);
    const gained = c.newScore - c.oldScore;
    const qty    = gained === 1 ? 'another' : `**${gained}** more`;
    const noun   = gained === 1 ? 'clue' : 'clues';
    return `**${displayName}** has completed ${qty} **${tier}** ${noun} for a total of **${formatNumber(c.newScore)}**`;
  });
  return base(COLORS.clue, lines, getClueIcon(changes[0].tier));
}

/**
 * Username change embed.
 */
export function buildNameChangeEmbed(oldName, newName) {
  return base(COLORS.nameChange, [
    `✏️ **${oldName}** has changed their name to **${newName}** – tracking updated automatically.`,
  ]);
}

// ---------------------------------------------------------------------------
// Milestone embeds
// ---------------------------------------------------------------------------

/**
 * Level 99 milestone – visually distinct from regular level-ups.
 */
export function buildLevel99Embed(displayName, skill) {
  return new EmbedBuilder()
    .setColor(COLORS.milestone)
    .setTitle(`🎉 LEVEL 99 – ${formatMetricName(skill)}!`)
    .setDescription(`**${displayName}** has achieved level **99** in **${formatMetricName(skill)}**! Congratulations! 🎊`)
    .setThumbnail(getSkillIcon(skill));
}

/**
 * Total level milestone (500 / 750 / 1000 / 1250 / 1500 / 1750 / 2000 / 2277).
 */
export function buildTotalLevelEmbed(displayName, totalLevel) {
  const isMax = totalLevel >= 2277;
  return new EmbedBuilder()
    .setColor(COLORS.milestone)
    .setTitle(isMax ? '👑 MAX TOTAL LEVEL!' : `⭐ Total Level ${totalLevel}!`)
    .setDescription(
      isMax
        ? `**${displayName}** has achieved the maximum total level of **2277**! MAXED OUT! 🏆`
        : `**${displayName}** has reached a total level of **${totalLevel}**! 🎯`,
    )
    .setThumbnail(getSkillIcon('overall'));
}

/**
 * Boss KC milestone (100 / 250 / 500 / 1000 / 2000 / 5000 / 10000).
 */
export function buildBossKCMilestoneEmbed(displayName, boss, kc) {
  return new EmbedBuilder()
    .setColor(COLORS.milestone)
    .setTitle(`💀 ${formatNumber(kc)} KC – ${formatMetricName(boss)}`)
    .setDescription(`**${displayName}** has reached **${formatNumber(kc)}** kills at **${formatMetricName(boss)}**! 🏆`)
    .setThumbnail(getBossIcon(boss));
}

// ---------------------------------------------------------------------------
// Weekly XP leaderboard
// ---------------------------------------------------------------------------

/**
 * Header embed for the weekly leaderboard post.
 */
export function buildWeeklyHeaderEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.weekly)
    .setTitle('📊 Biggest XP earners over the last week:')
    .setTimestamp();
}

/**
 * One embed per player in the weekly leaderboard.
 * Matches the ScapeBot screenshot layout.
 *
 * @param {{ username:string, xp:number }} player
 * @param {number} rank  0-indexed
 */
export function buildWeeklyPlayerEmbed(player, rank) {
  return new EmbedBuilder()
    .setColor(COLORS.weekly)
    .setDescription(`**${player.username}** with **${formatXp(player.xp)}** XP`)
    .setThumbnail(getXpBarIcon(rank));
}
