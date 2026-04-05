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
  loot:        0xffd700, // gold   – big drops
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
 * Level-up embed – ONE embed per skill change.
 * Call once per change; the notifier maps the array.
 *
 * @param {string} displayName
 * @param {{ skill, oldLevel, newLevel }} change
 */
export function buildLevelEmbed(displayName, change) {
  const gained = change.newLevel - change.oldLevel;
  const plural = gained === 1 ? 'level' : 'levels';
  return base(
    COLORS.skill,
    [`**${displayName}** has gained **${gained}** ${plural} in **${formatMetricName(change.skill)}** and is now level **${change.newLevel}**`],
    getSkillIcon(change.skill),
  );
}

/**
 * Boss kill embed – grouped per player (ScapeBot style: multiple bosses in one card).
 * "roryhole has completed...\nThe Royal Titans 13 more times...\nTombs of Amascut again..."
 *
 * @param {string} displayName
 * @param {Array<{ boss, oldKills, newKills }>} changes
 */
export function buildBossEmbed(displayName, changes) {
  const header = `**${displayName}** has completed…`;
  const lines  = changes.map(c => {
    const boss   = formatMetricName(c.boss);
    const gained = c.newKills - c.oldKills;
    const times  = gained === 1 ? 'again' : `**${gained}** more times`;
    return `**${boss}** ${times} for a total of **${formatNumber(c.newKills)}**`;
  });
  return base(COLORS.boss, [header, ...lines], getBossIcon(changes[0].boss));
}

/**
 * Achievement embed – ONE embed per achievement.
 *
 * @param {string} displayName
 * @param {{ name, metric, measure, threshold }} achievement
 */
export function buildAchievementEmbed(displayName, achievement) {
  return base(
    COLORS.achievement,
    [`**${displayName}** has unlocked: **${achievement.name}**`],
  );
}

/**
 * Clue scroll embed – ONE embed per tier.
 *
 * @param {string} displayName
 * @param {{ tier, oldScore, newScore }} change
 */
export function buildClueEmbed(displayName, change) {
  const tier   = CLUE_TIER[change.tier] ?? formatMetricName(change.tier);
  const gained = change.newScore - change.oldScore;
  const qty    = gained === 1 ? 'another' : `**${gained}** more`;
  const noun   = gained === 1 ? 'clue' : 'clues';
  return base(
    COLORS.clue,
    [`**${displayName}** has completed ${qty} **${tier}** ${noun} for a total of **${formatNumber(change.newScore)}**`],
    getClueIcon(change.tier),
  );
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

// ---------------------------------------------------------------------------
// Loot embeds
// ---------------------------------------------------------------------------

/** Format GP value compactly: 1234567 → "1.2M" */
export function formatGP(n) {
  if (!n || n < 0) return '0 gp';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B gp`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M gp`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K gp`;
  return `${n.toLocaleString('en-GB')} gp`;
}

/** Notification embed for a drop that crossed the GP threshold. */
export function buildBigDropEmbed(displayName, entry) {
  const isPet = entry.source?.toLowerCase().includes('pet') || entry.item_name?.toLowerCase().includes('pet');
  const color = isPet ? 0xff69b4 : COLORS.loot;
  const icon  = `https://oldschool.runescape.wiki/images/${encodeURIComponent(entry.item_name.replace(/ /g, '_'))}.png`;

  const lines = [
    `**${displayName}** received a drop:`,
    `**${entry.item_name}**${entry.qty > 1 ? ` x${entry.qty}` : ''} — **${formatGP(entry.value)}**`,
  ];
  if (entry.source && entry.source !== 'Unknown') lines.push(`*${entry.source}${entry.kc ? ` (KC: ${entry.kc})` : ''}*`);

  return new EmbedBuilder()
    .setColor(color)
    .setDescription(lines.join('\n'))
    .setThumbnail(icon)
    .setTimestamp(entry.ts ? new Date(entry.ts) : new Date());
}

/** One row in the loot leaderboard. */
export function buildLootLeaderboardEmbed(title, rows) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) =>
    `${medals[i] ?? `**${i + 1}.**`} **${r.player}** — ${formatGP(r.total)}`,
  );

  return new EmbedBuilder()
    .setColor(COLORS.loot)
    .setTitle(title)
    .setDescription(lines.length ? lines.join('\n') : '*No drops recorded yet.*');
}

/** Top single drops (hall of fame). */
export function buildTopDropsEmbed(rows) {
  const lines = rows.map((e, i) =>
    `**${i + 1}.** **${e.player}** — ${e.item_name}${e.qty > 1 ? ` x${e.qty}` : ''} (${formatGP(e.value)})`,
  );

  return new EmbedBuilder()
    .setColor(COLORS.loot)
    .setTitle('💰 Top Drops — Hall of Fame')
    .setDescription(lines.length ? lines.join('\n') : '*No drops recorded yet.*');
}
