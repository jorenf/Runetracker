/**
 * src/commands/help.js
 *
 * /help
 * Shows all available commands with descriptions.
 * Available to everyone.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds.js';

const COMMANDS = [
  // Setup
  {
    category: '⚙️ Setup',
    items: [
      { name: '/setchannel #channel', desc: 'Set the channel where tracking updates are posted. *(Admin)*' },
      { name: '/setadmin add @user',  desc: 'Grant a user bot-admin access without Manage Server. *(Admin)*' },
      { name: '/setadmin remove @user', desc: 'Revoke bot-admin access from a user. *(Admin)*' },
      { name: '/setadmin list',       desc: 'List all current bot admins. *(Admin)*' },
    ],
  },
  // Tracking
  {
    category: '🎯 Tracking',
    items: [
      { name: '/track <username>',    desc: 'Start tracking an OSRS player in this server. *(Admin)*' },
      { name: '/untrack <username>',  desc: 'Stop tracking an OSRS player. *(Admin)*' },
      { name: '/trackoption',         desc: 'View or toggle what is tracked: levels, bosses, achievements, clues. *(Admin)*' },
    ],
  },
  // Info
  {
    category: '📋 Info',
    items: [
      { name: '/settings',            desc: 'View all current bot settings: channel, options, players, admins.' },
      { name: '/lookup <username>',   desc: 'Quick stats overview for any OSRS player (combat, total level, top skills, boss KCs).' },
    ],
  },
  // Admin tools
  {
    category: '🔧 Admin Tools',
    items: [
      { name: '/status',              desc: 'Show tracker cycle status and last-update time per player. *(Admin)*' },
      { name: '/checkupdate',         desc: 'Force-refresh all tracked players immediately. *(Admin)*' },
      { name: '/checkupdate <username>', desc: 'Force-refresh one specific player and see what changed. *(Admin)*' },
      { name: '/weeklytop',           desc: 'Post the biggest XP earners of the last week. Also auto-posts every Monday. *(Admin)*' },
    ],
  },
];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available bot commands.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📖 Muskebeers – Command Overview')
      .setDescription(
        'This bot tracks your GIM group\'s OSRS progress via WiseOldMan.\n' +
        'Commands marked *(Admin)* require **Manage Server** or a custom bot admin role.\n\u200B',
      )
      .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

    for (const section of COMMANDS) {
      embed.addFields({
        name:   section.category,
        value:  section.items.map(c => `\`${c.name}\`\n${c.desc}`).join('\n\n'),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
