/**
 * src/commands/settings.js
 *
 * /settings
 *
 * Shows the current bot configuration for this server:
 *   • Announcement channel
 *   • Tracking toggles
 *   • Tracked players
 *   • Bot admins
 *
 * Available to everyone (read-only, no sensitive data exposed).
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queries, getEffectiveOptions } from '../db/index.js';
import { COLORS } from '../utils/embeds.js';

const on  = '✅ Enabled';
const off = '❌ Disabled';
const fmt = (v) => (v ? on : off);

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Show the current bot settings for this server.'),

  async execute(interaction) {
    const guildId  = interaction.guildId;
    const guildRow = queries.getGuild.get(guildId);

    // Channel
    const channel = guildRow?.channel_id
      ? `<#${guildRow.channel_id}>`
      : '⚠️ Not set – run `/setchannel` first';

    // Tracking options
    const opts    = getEffectiveOptions(guildId);

    // Tracked players
    const players = queries.getPlayersByGuild.all(guildId);
    const playerList = players.length
      ? players.map(p => `• **${p.username}**`).join('\n')
      : '_No players tracked yet – use `/track <username>`_';

    // Bot admins
    const admins    = queries.getGuildAdmins.all(guildId);
    const adminList = admins.length
      ? admins.map(a => `<@${a.user_id}>`).join(', ')
      : '_None – anyone with Manage Server has access_';

    const embed = new EmbedBuilder()
      .setColor(COLORS.nameChange)
      .setTitle(`⚙️ Bot Settings – ${interaction.guild.name}`)
      .addFields(
        { name: '📢 Announcement Channel', value: channel,           inline: false },
        { name: '\u200B', value: '**Tracking Options**',             inline: false },
        { name: '📈 Levels / XP',          value: fmt(opts.track_levels),        inline: true },
        { name: '⚔️ Boss Kills',            value: fmt(opts.track_bosses),        inline: true },
        { name: '🏆 Achievements',          value: fmt(opts.track_achievements),  inline: true },
        { name: '📜 Clue Scrolls',          value: fmt(opts.track_clues),         inline: true },
        { name: `\u200B`, value: `**Tracked Players (${players.length})**`,       inline: false },
        { name: '\u200B', value: playerList,                         inline: false },
        { name: '🔑 Bot Admins',            value: adminList,         inline: false },
      )
      .setFooter({ text: 'Wise Old Man • OSRS Tracker' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
