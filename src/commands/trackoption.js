/**
 * src/commands/trackoption.js
 *
 * /trackoption [category] [enabled]
 *
 * Configure which categories of updates are posted for this server.
 * Running with no arguments shows the current configuration.
 *
 * Categories:
 *   levels       – skill level-ups
 *   bosses       – boss kill count increases
 *   achievements – new WOM achievements
 *   clues        – clue scroll completions
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { queries, getEffectiveOptions } from '../db/index.js';
import { COLORS } from '../utils/embeds.js';
import logger from '../utils/logger.js';

// Map command option values → database column names.
const CATEGORY_MAP = {
  levels:       'track_levels',
  bosses:       'track_bosses',
  achievements: 'track_achievements',
  clues:        'track_clues',
};

/** Render a boolean DB value as a friendly string. */
const statusEmoji = (val) => (val ? '✅ Enabled' : '❌ Disabled');

export default {
  data: new SlashCommandBuilder()
    .setName('trackoption')
    .setDescription('Configure what categories of updates are posted for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Which tracking category to change (omit to view current settings).')
        .setRequired(false)
        .addChoices(
          { name: 'Levels / XP',    value: 'levels'       },
          { name: 'Boss Kills',     value: 'bosses'       },
          { name: 'Achievements',   value: 'achievements' },
          { name: 'Clue Scrolls',   value: 'clues'        },
        ),
    )
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('Enable or disable the selected category.')
        .setRequired(false),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const category = interaction.options.getString('category');
    const enabled  = interaction.options.getBoolean('enabled');

    const guildId  = interaction.guildId;

    // Ensure a guild row exists (needed for the FK on tracking_options).
    const guildRow = queries.getGuild.get(guildId);
    if (!guildRow) {
      return interaction.reply({
        content: 'Please run `/setchannel` first to set up this server.',
        ephemeral: true,
      });
    }

    // -----------------------------------------------------------------------
    // No arguments → show current configuration.
    // -----------------------------------------------------------------------
    if (!category) {
      const opts = getEffectiveOptions(guildId);

      const embed = new EmbedBuilder()
        .setColor(COLORS.nameChange)
        .setTitle('Tracking Options')
        .setDescription('Use `/trackoption category: … enabled: …` to change a setting.')
        .addFields(
          { name: 'Levels / XP',  value: statusEmoji(opts.track_levels),       inline: true },
          { name: 'Boss Kills',   value: statusEmoji(opts.track_bosses),        inline: true },
          { name: 'Achievements', value: statusEmoji(opts.track_achievements),  inline: true },
          { name: 'Clue Scrolls', value: statusEmoji(opts.track_clues),         inline: true },
        )
        .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // -----------------------------------------------------------------------
    // Category provided but no enabled value → show just that category.
    // -----------------------------------------------------------------------
    if (enabled === null || enabled === undefined) {
      const opts    = getEffectiveOptions(guildId);
      const col     = CATEGORY_MAP[category];
      const current = opts[col];

      return interaction.reply({
        content: `**${category}** tracking is currently ${statusEmoji(current)}.`,
        ephemeral: true,
      });
    }

    // -----------------------------------------------------------------------
    // Both provided → update the database.
    // -----------------------------------------------------------------------
    const col = CATEGORY_MAP[category];

    try {
      // Load current options (or defaults) then patch the changed column.
      const current = getEffectiveOptions(guildId);
      queries.upsertTrackingOptions.run({
        guild_id:          guildId,
        track_levels:      current.track_levels,
        track_bosses:      current.track_bosses,
        track_achievements: current.track_achievements,
        track_clues:       current.track_clues,
        [col]: enabled ? 1 : 0, // override just the requested column
      });

      logger.info(`Guild ${guildId} set ${col} = ${enabled ? 1 : 0}`);

      return interaction.reply({
        content: `**${category}** tracking is now ${statusEmoji(enabled)}. ✅`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('trackoption error:', err);
      return interaction.reply({
        content: 'Something went wrong updating the setting. Please try again.',
        ephemeral: true,
      });
    }
  },
};
