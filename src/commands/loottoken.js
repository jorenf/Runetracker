/**
 * src/commands/loottoken.js
 * /loottoken – generate or show the guild's loot webhook token.
 * Admin only. Members use this token in the RuneTracker RuneLite plugin.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { randomBytes } from 'crypto';
import { queries } from '../db/index.js';
import { isAdmin } from '../utils/admin.js';

export default {
  data: new SlashCommandBuilder()
    .setName('loottoken')
    .setDescription('Generate or view the loot webhook token for the RuneTracker plugin.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('show').setDescription('Show the current token.'),
    )
    .addSubcommand(sub =>
      sub.setName('regenerate').setDescription('Generate a new token (invalidates the old one).'),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: 'You need admin permissions to manage the loot token.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const settings = queries.getLootSettings.get(interaction.guildId);

    if (sub === 'show') {
      if (!settings?.loot_token) {
        return interaction.reply({
          content: 'No token generated yet. Use `/loottoken regenerate` to create one.',
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: [
          '**RuneTracker Loot Token**',
          `\`\`\`${settings.loot_token}\`\`\``,
          'Enter this token in the RuneTracker RuneLite plugin settings.',
          `Webhook endpoint: \`https://api.runetracker.icu/webhook/loot\``,
        ].join('\n'),
        ephemeral: true,
      });
    }

    // regenerate
    const token = `rt_${randomBytes(24).toString('hex')}`;
    queries.setLootToken.run(interaction.guildId, token);

    return interaction.reply({
      content: [
        '✅ **New loot token generated.**',
        `\`\`\`${token}\`\`\``,
        'Enter this token in the RuneTracker RuneLite plugin settings.',
        `Webhook endpoint: \`https://api.runetracker.icu/webhook/loot\``,
        '',
        '⚠️ The old token is now invalid — update it in the plugin for all clan members.',
      ].join('\n'),
      ephemeral: true,
    });
  },
};
