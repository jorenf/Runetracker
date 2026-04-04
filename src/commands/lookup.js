/**
 * src/commands/lookup.js
 *
 * /lookup <username>
 * Quick stats overview for any OSRS player via WiseOldMan.
 * Shows: combat level, total level, top skills by XP, top boss KCs.
 * Available to everyone.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { resolvePlayer } from '../services/wom.js';
import { COLORS, formatNumber, formatXp, formatMetricName } from '../utils/embeds.js';
import { getSkillIcon } from '../utils/wikicons.js';
import logger from '../utils/logger.js';

// Skills shown in the "top skills" section (by XP, sorted at runtime).
const DISPLAY_SKILLS = [
  'attack','defence','strength','hitpoints','ranged','prayer','magic',
  'cooking','woodcutting','fletching','fishing','firemaking','crafting',
  'smithing','mining','herblore','agility','thieving','slayer','farming',
  'runecrafting','hunter','construction',
];

export default {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up stats for any OSRS player.')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('RuneScape username to look up.')
        .setRequired(true)
        .setMaxLength(12),
    ),

  async execute(interaction) {
    const username = interaction.options.getString('username').trim();
    await interaction.deferReply();

    let player;
    try {
      player = await resolvePlayer(username);
    } catch (err) {
      logger.warn(`[Lookup] Could not find player ${username}: ${err.message}`);
      return interaction.editReply(`Could not find player **${username}** on WiseOldMan.`);
    }

    const snap = player.latestSnapshot?.data;
    if (!snap) {
      return interaction.editReply(`No hiscores data found for **${player.displayName ?? username}**.`);
    }

    const skills    = snap.skills   ?? {};
    const bosses    = snap.bosses   ?? {};
    const overall   = skills.overall ?? {};
    const totalLevel = overall.level ?? '?';
    const totalXp    = overall.experience ?? 0;

    // Combat level (OSRS formula)
    const att  = skills.attack?.level    ?? 1;
    const def  = skills.defence?.level   ?? 1;
    const str  = skills.strength?.level  ?? 1;
    const hp   = skills.hitpoints?.level ?? 10;
    const pray = skills.prayer?.level    ?? 1;
    const rang = skills.ranged?.level    ?? 1;
    const mag  = skills.magic?.level     ?? 1;
    const base = 0.25 * (def + hp + Math.floor(pray / 2));
    const melee  = 0.325 * (att + str);
    const ranger = 0.325 * Math.floor(rang * 1.5);
    const mager  = 0.325 * Math.floor(mag * 1.5);
    const combatLevel = Math.floor(base + Math.max(melee, ranger, mager));

    // Top 5 skills by XP (excluding overall)
    const topSkills = DISPLAY_SKILLS
      .map(k => ({ key: k, xp: skills[k]?.experience ?? 0, level: skills[k]?.level ?? 1 }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);

    // Top 5 bosses by KC (ignore -1 = unranked)
    const topBosses = Object.entries(bosses)
      .map(([k, v]) => ({ key: k, kc: v.kills ?? -1 }))
      .filter(b => b.kc > 0)
      .sort((a, b) => b.kc - a.kc)
      .slice(0, 5);

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`📋 ${player.displayName ?? player.username}`)
      .setURL(`https://wiseoldman.net/players/${encodeURIComponent(player.username)}`)
      .setThumbnail(getSkillIcon('overall'))
      .addFields(
        {
          name:   '⚔️ Combat Level',
          value:  `**${combatLevel}**`,
          inline: true,
        },
        {
          name:   '🌟 Total Level',
          value:  `**${formatNumber(totalLevel)}** *(${formatXp(totalXp)} XP)*`,
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
          name:   '📈 Top Skills',
          value:  topSkills.length
            ? topSkills.map(s =>
                `**${formatMetricName(s.key)}** – Lv **${s.level}** *(${formatXp(s.xp)} XP)*`,
              ).join('\n')
            : '_No data_',
          inline: true,
        },
        {
          name:   '💀 Top Bosses',
          value:  topBosses.length
            ? topBosses.map(b =>
                `**${formatMetricName(b.key)}** – **${formatNumber(b.kc)}** KC`,
              ).join('\n')
            : '_No boss data_',
          inline: true,
        },
      )
      .setFooter({ text: `WOM ID: ${player.id} • Last updated` })
      .setTimestamp(player.updatedAt ? new Date(player.updatedAt) : new Date());

    return interaction.editReply({ embeds: [embed] });
  },
};
