/**
 * src/commands/spamfilter.js
 * /spamfilter – configure spam prevention thresholds.
 * Admin only.
 *
 * Settings:
 *   min_level   – ignore level-ups below this level (default: 30)
 *   min_boss_kc – ignore boss kills below this KC (default: 5)
 *   cooldown    – minimum hours between notifications per player (default: 0 = off)
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { queries, getEffectiveOptions } from '../db/index.js';
import { COLORS } from '../utils/embeds.js';
import { isAdmin } from '../utils/admin.js';

export default {
  data: new SlashCommandBuilder()
    .setName('spamfilter')
    .setDescription('Configure spam prevention thresholds for notifications.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt =>
      opt.setName('min_level')
        .setDescription('Only notify level-ups at or above this level. 0 = all levels. (default: 30)')
        .setMinValue(0)
        .setMaxValue(126)
        .setRequired(false),
    )
    .addIntegerOption(opt =>
      opt.setName('min_boss_kc')
        .setDescription('Only notify boss kills at or above this KC. 0 = all kills. (default: 5)')
        .setMinValue(0)
        .setRequired(false),
    )
    .addNumberOption(opt =>
      opt.setName('cooldown')
        .setDescription('Min hours between notifications per player. 0 = no cooldown. (default: 0)')
        .setMinValue(0)
        .setMaxValue(168)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: 'Admin only.', ephemeral: true });
    }

    const minLevel   = interaction.options.getInteger('min_level');
    const minBossKC  = interaction.options.getInteger('min_boss_kc');
    const cooldown   = interaction.options.getNumber('cooldown');

    const anyProvided = minLevel !== null || minBossKC !== null || cooldown !== null;

    // ── Show current settings ────────────────────────────────────────────────
    if (!anyProvided) {
      const opts = getEffectiveOptions(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('Spam Filter Settings')
        .setDescription('Use `/spamfilter min_level:30 min_boss_kc:5 cooldown:1` to update.')
        .addFields(
          {
            name:   'Min level to notify',
            value:  `**${opts.min_level_notify ?? 30}**\n*Level-ups below this are ignored*`,
            inline: true,
          },
          {
            name:   'Min boss KC to notify',
            value:  `**${opts.min_boss_kc_notify ?? 5}**\n*Boss kills below this are ignored*`,
            inline: true,
          },
          {
            name:   'Notification cooldown',
            value:  opts.cooldown_hours
              ? `**${opts.cooldown_hours}h**\n*Max one notification burst per player per ${opts.cooldown_hours}h*`
              : `**Off**\n*No cooldown between notifications*`,
            inline: true,
          },
        )
        .setFooter({ text: 'Level 99s and milestones always fire regardless of these settings.' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Update settings ──────────────────────────────────────────────────────
    queries.setSpamFilter.run(interaction.guildId, {
      ...(minLevel  !== null && { min_level_notify:   minLevel  }),
      ...(minBossKC !== null && { min_boss_kc_notify: minBossKC }),
      ...(cooldown  !== null && { cooldown_hours:     cooldown  }),
    });

    const opts = getEffectiveOptions(interaction.guildId);
    const lines = [];
    if (minLevel  !== null) lines.push(`Min level: **${opts.min_level_notify}**`);
    if (minBossKC !== null) lines.push(`Min boss KC: **${opts.min_boss_kc_notify}**`);
    if (cooldown  !== null) lines.push(`Cooldown: **${opts.cooldown_hours > 0 ? `${opts.cooldown_hours}h` : 'off'}**`);

    return interaction.reply({
      content: `✅ Spam filter updated:\n${lines.join('\n')}\n\n*Level 99s and milestones always fire regardless.*`,
      ephemeral: true,
    });
  },
};
