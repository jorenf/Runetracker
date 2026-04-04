/**
 * src/commands/untrack.js
 *
 * /untrack <username>
 * Removes a player from tracking for this server.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { queries } from '../db/index.js';
import { isAdmin, replyNoPermission } from '../utils/admin.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('untrack')
    .setDescription('Stop tracking an OSRS player in this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('The RuneScape username to remove.')
        .setRequired(true)
        .setMaxLength(12),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) return replyNoPermission(interaction);

    const username = interaction.options.getString('username').trim();
    const player   = queries.getPlayerByUsernameAndGuild.get(username, interaction.guildId);

    if (!player) {
      return interaction.reply({
        content: `**${username}** is not being tracked in this server.`,
        ephemeral: true,
      });
    }

    queries.deletePlayer.run(player.wom_id, interaction.guildId);
    logger.info(`[Untrack] Guild ${interaction.guildId} stopped tracking ${player.username} (wom_id=${player.wom_id})`);

    return interaction.reply({
      content: `Stopped tracking **${player.username}**. ✅`,
      ephemeral: true,
    });
  },
};
