/**
 * src/commands/setadmin.js
 *
 * /setadmin add @user     – grant bot-admin access to a user
 * /setadmin remove @user  – revoke bot-admin access
 * /setadmin list          – show current bot admins
 *
 * Only Discord "Manage Guild" users can run this command.
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { queries } from '../db/index.js';
import { COLORS } from '../utils/embeds.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setadmin')
    .setDescription('Manage bot admins for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Grant a user bot-admin access.')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to add as admin.').setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Revoke bot-admin access from a user.')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove.').setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all current bot admins.'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const admins = queries.getGuildAdmins.all(interaction.guildId);

      if (!admins.length) {
        return interaction.reply({
          content: 'No custom bot admins set. Anyone with **Manage Server** can use admin commands.',
          ephemeral: true,
        });
      }

      const lines = admins.map(a => `<@${a.user_id}>`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(COLORS.nameChange)
        .setTitle('Bot Admins')
        .setDescription(lines)
        .setFooter({ text: 'Users with Manage Server permission also have admin access.' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── add / remove ──────────────────────────────────────────────────────────
    const target = interaction.options.getUser('user');

    if (target.bot) {
      return interaction.reply({ content: 'Bots cannot be admins.', ephemeral: true });
    }

    if (sub === 'add') {
      queries.addGuildAdmin.run({ guild_id: interaction.guildId, user_id: target.id });
      logger.info(`[SetAdmin] ${interaction.user.tag} added ${target.tag} as admin in guild ${interaction.guildId}`);
      return interaction.reply({
        content: `${target} is now a bot admin. ✅`,
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      queries.removeGuildAdmin.run(interaction.guildId, target.id);
      logger.info(`[SetAdmin] ${interaction.user.tag} removed ${target.tag} as admin in guild ${interaction.guildId}`);
      return interaction.reply({
        content: `${target} has been removed from bot admins. ✅`,
        ephemeral: true,
      });
    }
  },
};
