/**
 * src/commands/setlootchannel.js
 * /setlootchannel – set where big drop notifications are posted.
 * Admin only.
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { queries } from '../db/index.js';
import { isAdmin } from '../utils/admin.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setlootchannel')
    .setDescription('Set the channel where big drop notifications are posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The text channel for drop notifications.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addIntegerOption(opt =>
      opt.setName('threshold')
        .setDescription('Minimum drop value in GP to trigger a notification (default: 10,000,000).')
        .setMinValue(0)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }

    const channel   = interaction.options.getChannel('channel');
    const threshold = interaction.options.getInteger('threshold') ?? null;

    queries.setLootChannel.run(interaction.guildId, channel.id);
    if (threshold !== null) queries.setLootThreshold.run(interaction.guildId, threshold);

    const thresholdStr = threshold !== null
      ? `${threshold.toLocaleString('en-GB')} gp`
      : '10,000,000 gp (default)';

    return interaction.reply({
      content: `✅ Drop notifications will be posted in <#${channel.id}>.\nThreshold: **${thresholdStr}**`,
      ephemeral: true,
    });
  },
};
