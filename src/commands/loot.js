/**
 * src/commands/loot.js
 * /loot [period] – show the loot leaderboard for this server.
 *
 * Periods: week (default) | month | all
 */

import { SlashCommandBuilder } from 'discord.js';
import { queries } from '../db/index.js';
import { buildLootLeaderboardEmbed, formatGP } from '../utils/embeds.js';

const PERIODS = {
  week:  7  * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  all:   0,
};

function aggregateByPlayer(entries) {
  const map = new Map(); // player → { total, drops }
  for (const e of entries) {
    const prev = map.get(e.player) ?? { player: e.player, total: 0, drops: 0 };
    prev.total += e.value ?? 0;
    prev.drops += 1;
    map.set(e.player, prev);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
}

export default {
  data: new SlashCommandBuilder()
    .setName('loot')
    .setDescription('Show the loot leaderboard for this server.')
    .addStringOption(opt =>
      opt.setName('period')
        .setDescription('Time period (default: week)')
        .addChoices(
          { name: 'This week',  value: 'week'  },
          { name: 'This month', value: 'month' },
          { name: 'All time',   value: 'all'   },
        )
        .setRequired(false),
    ),

  async execute(interaction) {
    const period  = interaction.options.getString('period') ?? 'week';
    const sinceMs = PERIODS[period] ? Date.now() - PERIODS[period] : 0;
    const entries = queries.getLootEntries.all(interaction.guildId, sinceMs);

    if (!entries.length) {
      return interaction.reply({
        content: `No drops recorded yet${period !== 'all' ? ` this ${period}` : ''}. Make sure the RuneTracker plugin is set up correctly.`,
        ephemeral: true,
      });
    }

    const rows = aggregateByPlayer(entries);
    const totalGP = entries.reduce((s, e) => s + (e.value ?? 0), 0);

    const title = period === 'all'
      ? `💰 All-time Loot Leaderboard — ${entries.length} drops (${formatGP(totalGP)} total)`
      : `💰 Loot Leaderboard — This ${period} (${formatGP(totalGP)} total)`;

    return interaction.reply({ embeds: [buildLootLeaderboardEmbed(title, rows)] });
  },
};
