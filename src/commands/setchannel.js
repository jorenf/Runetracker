/**
 * src/commands/setchannel.js
 *
 * /setchannel #channel
 *
 * Sets the Discord channel where tracking updates will be posted for this
 * server.  Requires the "Manage Guild" permission.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { queries } from '../db/index.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel where OSRS tracking updates are posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The text channel to post updates in.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    // Ensure the bot can send messages in the chosen channel.
    const botMember = interaction.guild.members.me;
    if (!channel.permissionsFor(botMember).has('SendMessages')) {
      return interaction.reply({
        content: `I don't have permission to send messages in ${channel}. Please adjust my permissions and try again.`,
        ephemeral: true,
      });
    }

    try {
      // Make sure the guild row exists before inserting options / players.
      queries.upsertGuild.run({
        guild_id:   interaction.guildId,
        channel_id: channel.id,
      });

      logger.info(`Guild ${interaction.guildId} set announcement channel to ${channel.id}`);

      return interaction.reply({
        content: `Updates will now be posted in ${channel}. ✅`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('setchannel error:', err);
      return interaction.reply({
        content: 'Something went wrong saving the channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
