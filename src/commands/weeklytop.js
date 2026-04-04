/**
 * src/commands/weeklytop.js
 *
 * /weeklytop
 * Posts the biggest XP earners over the last week for all tracked players.
 * Also called automatically every Monday by the tracker service.
 *
 * Admin only – uses the configured announcement channel.
 */

import { SlashCommandBuilder } from 'discord.js';
import { queries } from '../db/index.js';
import { getPlayerGains } from '../services/wom.js';
import { buildWeeklyHeaderEmbed, buildWeeklyPlayerEmbed } from '../utils/embeds.js';
import { isAdmin, replyNoPermission } from '../utils/admin.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('weeklytop')
    .setDescription('Show the biggest XP earners over the last week (admin only).'),

  async execute(interaction) {
    if (!isAdmin(interaction)) return replyNoPermission(interaction);

    const players = queries.getPlayersByGuild.all(interaction.guildId);
    if (!players.length) {
      return interaction.reply({
        content: 'No players are tracked yet. Use `/track <username>` to add someone.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const results = await fetchWeeklyXp(players);

    if (!results.length) {
      return interaction.editReply('No XP data found for this week. Make sure players have been updated recently.');
    }

    const guildRow = queries.getGuild.get(interaction.guildId);
    if (!guildRow?.channel_id) {
      return interaction.editReply('Please set an announcement channel first with `/setchannel`.');
    }

    try {
      const channel = await interaction.client.channels.fetch(guildRow.channel_id);
      await postWeeklyLeaderboard(channel, results);
      return interaction.editReply(`Weekly leaderboard posted in <#${guildRow.channel_id}>! ✅`);
    } catch (err) {
      logger.error('[WeeklyTop] Failed to post leaderboard:', err);
      return interaction.editReply(`Failed to post: ${err.message}`);
    }
  },
};

// ---------------------------------------------------------------------------
// Shared helpers (also exported for use by the auto-post in tracker.js)
// ---------------------------------------------------------------------------

/**
 * Fetch weekly XP gains for a list of player rows.
 * Returns sorted array of { username, xp }, filtering out players with 0 XP.
 *
 * @param {Array<{username:string}>} players
 * @returns {Promise<Array<{username:string, xp:number}>>}
 */
export async function fetchWeeklyXp(players) {
  const results = [];

  for (const player of players) {
    try {
      const gains = await getPlayerGains(player.username, 'week');
      const xp    = gains?.data?.skills?.overall?.experience?.gained ?? 0;
      if (xp > 0) results.push({ username: player.username, xp });
      logger.debug(`[WeeklyTop] ${player.username}: ${xp} XP gained this week`);
    } catch (err) {
      logger.warn(`[WeeklyTop] Could not fetch gains for ${player.username}: ${err.message}`);
    }
  }

  return results.sort((a, b) => b.xp - a.xp);
}

/**
 * Post the weekly leaderboard embeds to a channel.
 * Header embed + one compact embed per player, exactly like the screenshot.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {Array<{username:string, xp:number}>} results  sorted best-first
 */
export async function postWeeklyLeaderboard(channel, results) {
  const header      = buildWeeklyHeaderEmbed();
  const playerEmbeds = results.map((p, i) => buildWeeklyPlayerEmbed(p, i));

  // Send header + first batch of players in one message (max 10 embeds total).
  const allEmbeds = [header, ...playerEmbeds];
  for (let i = 0; i < allEmbeds.length; i += 10) {
    await channel.send({ embeds: allEmbeds.slice(i, i + 10) });
  }

  logger.info(`[WeeklyTop] Posted leaderboard to channel ${channel.id} (${results.length} players)`);
}
