/**
 * src/utils/admin.js
 * Helper to check whether a user has bot-admin access for a guild.
 *
 * A user is considered an admin if they have the Discord "Manage Guild"
 * permission OR if they have been added via /setadmin.
 */

import { PermissionFlagsBits } from 'discord.js';
import { queries } from '../db/index.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {boolean}
 */
export function isAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return !!queries.isGuildAdmin.get(interaction.guildId, interaction.user.id);
}

/** Reply with a standard "no permission" message (ephemeral). */
export function replyNoPermission(interaction) {
  return interaction.reply({
    content: 'You need **Manage Server** permission or must be a bot admin to use this command.',
    ephemeral: true,
  });
}
