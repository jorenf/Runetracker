/**
 * src/commands/track.js
 *
 * /track <username>
 *
 * Adds a RuneScape player to the tracking list for this server.
 * - Looks up the player on WiseOldMan (creating a WOM profile if needed).
 * - Stores the WOM player ID as the stable key (survives username changes).
 * - Takes an initial snapshot so the first diff has a baseline.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { queries } from '../db/index.js';
import { resolvePlayer, getPlayerAchievements } from '../services/wom.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('track')
    .setDescription('Start tracking an Old School RuneScape player.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The RuneScape username to track.')
        .setRequired(true)
        .setMaxLength(12),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const username = interaction.options.getString('username').trim();

    // Verify a channel has been configured for this guild.
    const guildRow = queries.getGuild.get(interaction.guildId);
    if (!guildRow?.channel_id) {
      return interaction.reply({
        content: 'Please run `/setchannel` first to configure where updates will be posted.',
        ephemeral: true,
      });
    }

    // Defer immediately – the WOM API call can take a few seconds.
    await interaction.deferReply({ ephemeral: true });

    // Check for a duplicate before hitting the API.
    const existing = queries.getPlayerByUsernameAndGuild.get(username, interaction.guildId);
    if (existing) {
      return interaction.editReply(
        `**${username}** is already being tracked in this server.`,
      );
    }

    // --- Resolve via WiseOldMan ---
    let player;
    try {
      player = await resolvePlayer(username);
    } catch (err) {
      logger.warn(`/track failed for '${username}': ${err.message}`);
      return interaction.editReply(
        `Could not find player **${username}** on WiseOldMan.\n` +
        `Make sure the username is spelled correctly and has been logged in to OSRS recently.`,
      );
    }

    const womId       = player.id;
    const displayName = player.displayName ?? player.username;

    // --- Persist player to DB ---
    try {
      queries.upsertPlayer.run({
        wom_id:   womId,
        username: player.username,
        guild_id: interaction.guildId,
      });
    } catch (err) {
      logger.error(`DB error adding player ${womId}:`, err);
      return interaction.editReply('Database error – please try again.');
    }

    // --- Store an initial snapshot (baseline for the first diff) ---
    const existingSnap = queries.getSnapshot.get(womId);
    if (!existingSnap) {
      // Build a minimal snapshot from the player object.
      const snap = player.latestSnapshot?.data;
      if (snap) {
        let achievements = [];
        let achievementsLoaded = false;
        try {
          achievements = await getPlayerAchievements(player.username);
          achievementsLoaded = true;
        } catch {
          // Non-fatal – achievements just won't diff on the very first run.
        }

        queries.upsertSnapshot.run({
          wom_id:        womId,
          username:      player.username,
          snapshot_json: JSON.stringify({
            username:     player.username,
            skills:       snap.skills     ?? {},
            bosses:       snap.bosses     ?? {},
            activities:   snap.activities ?? {},
            achievements,
            achievements_loaded: achievementsLoaded,
          }),
          updated_at: Date.now(),
        });
        logger.info(`Stored initial snapshot for ${displayName} (wom_id=${womId}).`);
      }
    }

    logger.info(`Guild ${interaction.guildId} now tracking ${displayName} (wom_id=${womId}).`);

    return interaction.editReply(
      `Now tracking **${displayName}**! ✅\n` +
      `Updates will be posted in <#${guildRow.channel_id}> after the next scan.`,
    );
  },
};
