/**
 * src/commands/checkupdate.js
 *
 * /checkupdate [username]
 *
 * Admin-only. Manually triggers a WiseOldMan refresh outside the normal schedule.
 *
 *   /checkupdate              – refresh ALL tracked players in this server
 *   /checkupdate username:X   – refresh only player X
 *
 * The command replies with a detailed result so admins can verify the bot works.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { triggerPlayer, triggerFullCycle, getTrackerState } from '../services/tracker.js';
import { COLORS } from '../utils/embeds.js';
import { isAdmin, replyNoPermission } from '../utils/admin.js';
import { queries } from '../db/index.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('checkupdate')
    .setDescription('Manually trigger a stat refresh (admin only).')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Player to refresh. Leave empty to refresh all tracked players.')
        .setRequired(false)
        .setMaxLength(12),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) return replyNoPermission(interaction);

    const { cycleRunning } = getTrackerState();
    if (cycleRunning) {
      return interaction.reply({
        content: '⏳ A tracker cycle is already running. Please wait for it to finish.',
        ephemeral: true,
      });
    }

    const username = interaction.options.getString('username')?.trim();

    // Defer: WOM API calls can take several seconds.
    await interaction.deferReply({ ephemeral: true });

    // ── Single player ─────────────────────────────────────────────────────────
    if (username) {
      logger.info(`[CheckUpdate] Manual trigger for '${username}' by ${interaction.user.tag}`);

      let result;
      try {
        result = await triggerPlayer(username, interaction.guildId);
      } catch (err) {
        logger.error('[CheckUpdate] triggerPlayer error:', err);
        return interaction.editReply(`❌ Error: ${err.message}`);
      }

      if (!result.success) {
        return interaction.editReply(`❌ ${result.error ?? 'Unknown error.'}`);
      }

      const guildRow = queries.getGuild.get(interaction.guildId);
      const channel  = guildRow?.channel_id ? `<#${guildRow.channel_id}>` : '_no channel set_';

      const embed = new EmbedBuilder()
        .setColor(COLORS.nameChange)
        .setTitle(`🔄 Manual Update – ${result.displayName}`)
        .setTimestamp()
        .setFooter({ text: 'Wise Old Man • OSRS Tracker' });

      if (result.firstRun) {
        embed
          .setColor(COLORS.clue)
          .setDescription(
            `✅ First snapshot stored for **${result.displayName}**.\n` +
            `Changes will be detected from the next update onwards.`,
          );
      } else if (result.nameChanged) {
        embed.setDescription(
          `✏️ Username changed: **${result.oldName}** → **${result.displayName}**\n` +
          `Notification sent to ${channel}.`,
        );
      } else {
        const { levels, bosses, achievements, clues } = result.changes;
        const total = levels + bosses + achievements + clues;

        if (total === 0) {
          embed
            .setColor(COLORS.error)
            .setDescription(`✅ **${result.displayName}** is up to date – no changes detected.`);
        } else {
          const lines = [];
          if (levels)       lines.push(`📈 **${levels}** level-up(s)`);
          if (bosses)       lines.push(`⚔️ **${bosses}** boss kill increase(s)`);
          if (achievements) lines.push(`🏆 **${achievements}** new achievement(s)`);
          if (clues)        lines.push(`📜 **${clues}** clue scroll completion(s)`);

          embed.setDescription(
            `Changes found for **${result.displayName}** and posted to ${channel}:\n\n` +
            lines.join('\n'),
          );
        }
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── All players ───────────────────────────────────────────────────────────
    logger.info(`[CheckUpdate] Manual full cycle triggered by ${interaction.user.tag}`);

    const players = queries.getPlayersByGuild.all(interaction.guildId);
    if (!players.length) {
      return interaction.editReply('No players are being tracked in this server yet. Use `/track <username>` to add one.');
    }

    await interaction.editReply(`⏳ Refreshing **${players.length}** player(s)… This may take a moment.`);

    try {
      await triggerFullCycle();
    } catch (err) {
      logger.error('[CheckUpdate] triggerFullCycle error:', err);
      return interaction.editReply(`❌ Error during cycle: ${err.message}`);
    }

    const guildRow = queries.getGuild.get(interaction.guildId);
    const channel  = guildRow?.channel_id ? `<#${guildRow.channel_id}>` : '_no channel set_';

    return interaction.editReply(
      `✅ Refresh complete for **${players.length}** player(s).\n` +
      `Any changes have been posted to ${channel}.`,
    );
  },
};
