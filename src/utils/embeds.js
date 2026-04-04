/**
 * src/utils/embeds.js
 * Factory functions for Discord embeds.  Centralising embed construction keeps
 * the notification logic clean and makes visual tweaks easy.
 */

import { EmbedBuilder } from 'discord.js';

// OSRS-themed colour palette.
export const COLORS = {
  skill:       0xffb347, // warm orange  – XP / level ups
  boss:        0xe74c3c, // red          – boss kills
  achievement: 0xf1c40f, // gold         – achievements
  clue:        0x2ecc71, // green        – clue scrolls
  nameChange:  0x3498db, // blue         – username change
  error:       0x95a5a6, // grey         – error / info
};

/** Format a number with thousands separators (e.g. 1234567 → "1,234,567"). */
export function formatNumber(n) {
  if (n == null || n < 0) return '—';
  return Number(n).toLocaleString('en-GB');
}

/**
 * Build an embed announcing one or more level-up events.
 *
 * @param {string} displayName  – In-game name to show in the title.
 * @param {Array<{skill, oldLevel, newLevel, oldXp, newXp}>} changes
 */
export function buildLevelEmbed(displayName, changes) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.skill)
    .setTitle(`📈 Level Up – ${displayName}`)
    .setTimestamp()
    .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

  for (const c of changes) {
    const skillName = formatMetricName(c.skill);
    const xpGained  = formatNumber(c.newXp - c.oldXp);
    embed.addFields({
      name:   skillName,
      value:  `Level **${c.oldLevel}** → **${c.newLevel}**\nXP gained: ${xpGained}`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Build an embed for boss kill count increases.
 *
 * @param {string} displayName
 * @param {Array<{boss, oldKills, newKills}>} changes
 */
export function buildBossEmbed(displayName, changes) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.boss)
    .setTitle(`⚔️ Boss Kills – ${displayName}`)
    .setTimestamp()
    .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

  for (const c of changes) {
    const bossName = formatMetricName(c.boss);
    const gained   = c.newKills - c.oldKills;
    embed.addFields({
      name:   bossName,
      value:  `${formatNumber(c.oldKills)} → **${formatNumber(c.newKills)}** *(+${formatNumber(gained)})*`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Build an embed for new achievements.
 *
 * @param {string} displayName
 * @param {Array<{name, metric, measure, threshold}>} achievements
 */
export function buildAchievementEmbed(displayName, achievements) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.achievement)
    .setTitle(`🏆 Achievement Unlocked – ${displayName}`)
    .setTimestamp()
    .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

  for (const a of achievements) {
    embed.addFields({
      name:   a.name,
      value:  `${formatMetricName(a.metric)} • ${formatNumber(a.threshold)} ${a.measure}`,
      inline: false,
    });
  }

  return embed;
}

/**
 * Build an embed for clue scroll completions.
 *
 * @param {string} displayName
 * @param {Array<{tier, oldScore, newScore}>} changes
 */
export function buildClueEmbed(displayName, changes) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.clue)
    .setTitle(`📜 Clue Scroll – ${displayName}`)
    .setTimestamp()
    .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

  for (const c of changes) {
    const tierName = formatMetricName(c.tier);
    const gained   = c.newScore - c.oldScore;
    embed.addFields({
      name:   tierName,
      value:  `${formatNumber(c.oldScore)} → **${formatNumber(c.newScore)}** *(+${formatNumber(gained)})*`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Build an embed announcing a username change.
 *
 * @param {string} oldName
 * @param {string} newName
 */
export function buildNameChangeEmbed(oldName, newName) {
  return new EmbedBuilder()
    .setColor(COLORS.nameChange)
    .setTitle('✏️ Player Renamed')
    .setDescription(`**${oldName}** has changed their name to **${newName}**.\nTracking will continue automatically.`)
    .setTimestamp()
    .setFooter({ text: 'Wise Old Man • OSRS Tracker' });
}

/**
 * Convert a snake_case metric key into a human-readable title.
 * e.g. "abyssal_sire" → "Abyssal Sire"
 *      "clue_scrolls_elite" → "Clue Scrolls Elite"
 */
export function formatMetricName(key) {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
