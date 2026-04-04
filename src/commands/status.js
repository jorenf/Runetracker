/**
 * src/commands/status.js
 *
 * /status
 *
 * Admin-only. Shows:
 *   • Whether the tracker is currently running
 *   • When the last cycle completed
 *   • When the next cycle is scheduled
 *   • Per-player: last snapshot time
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queries } from '../db/index.js';
import { getTrackerState } from '../services/tracker.js';
import { COLORS } from '../utils/embeds.js';
import { isAdmin, replyNoPermission } from '../utils/admin.js';

/** Format a Date (or null) as a Discord relative timestamp + absolute time. */
function fmtTime(date) {
  if (!date) return '_Not yet_';
  const ts = Math.floor(date.getTime() / 1000);
  return `<t:${ts}:R> (<t:${ts}:T>)`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show tracker status and last-update times for all tracked players.'),

  async execute(interaction) {
    if (!isAdmin(interaction)) return replyNoPermission(interaction);

    const state   = getTrackerState();
    const players = queries.getPlayersByGuild.all(interaction.guildId);

    // Build per-player lines
    const playerLines = players.map(p => {
      const snap = queries.getSnapshot.get(p.wom_id);
      if (!snap) return `• **${p.username}** – _pending first scan_`;
      const ts = Math.floor(snap.updated_at / 1000);
      return `• **${p.username}** – last updated <t:${ts}:R>`;
    });

    const embed = new EmbedBuilder()
      .setColor(state.cycleRunning ? COLORS.boss : COLORS.skill)
      .setTitle('🕐 Tracker Status')
      .addFields(
        {
          name:  'Cycle Running',
          value: state.cycleRunning ? '🔄 Yes – in progress…' : '✅ No – idle',
          inline: true,
        },
        {
          name:  'Poll Interval',
          value: `${state.intervalMs / 1000}s`,
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
          name:  'Last Cycle Completed',
          value: fmtTime(state.lastCycleAt),
          inline: true,
        },
        {
          name:  'Next Cycle Scheduled',
          value: fmtTime(state.nextCycleAt),
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
          name:  `Tracked Players (${players.length})`,
          value: playerLines.length ? playerLines.join('\n') : '_No players tracked yet._',
          inline: false,
        },
      )
      .setFooter({ text: 'Wise Old Man • OSRS Tracker' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
