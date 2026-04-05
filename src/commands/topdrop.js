/**
 * src/commands/topdrop.js
 * /topdrop [player] – hall of fame for biggest single drops.
 */

import { SlashCommandBuilder } from 'discord.js';
import { queries } from '../db/index.js';
import { buildTopDropsEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('topdrop')
    .setDescription('Show the biggest single drops — hall of fame.')
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Filter to a specific player (optional).')
        .setRequired(false),
    ),

  async execute(interaction) {
    const playerFilter = interaction.options.getString('player')?.toLowerCase() ?? null;
    let entries = queries.getLootEntries.all(interaction.guildId, 0);

    if (playerFilter) {
      entries = entries.filter(e => e.player.toLowerCase() === playerFilter);
    }

    if (!entries.length) {
      return interaction.reply({
        content: playerFilter
          ? `No drops found for **${playerFilter}**.`
          : 'No drops recorded yet. Make sure the RuneTracker plugin is set up correctly.',
        ephemeral: true,
      });
    }

    const top = [...entries].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 10);

    return interaction.reply({ embeds: [buildTopDropsEmbed(top)] });
  },
};
