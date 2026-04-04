/**
 * src/commands/setgroup.js
 * /setgroup <name> — search WOM for a group and link it to the guild.
 * Admin only. Shows a confirm/cancel flow before saving.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { searchGroups, getGroupMembers } from '../services/wom.js';
import { queries } from '../db/index.js';
import logger from '../utils/logger.js';

const EMBED_COLOR = 0xC8A96A;

/** Pending confirmations: `${guildId}:${userId}` → { group } */
const pending = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('setgroup')
    .setDescription('Link a WOM clan/group to this server for automatic member tracking.')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('The WOM group name to search for.')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    let results;
    try {
      results = await searchGroups(name);
    } catch (err) {
      logger.warn(`[setgroup] Search failed: ${err.message}`);
      return interaction.editReply({ content: `Failed to search WOM: ${err.message}` });
    }

    if (!results?.length) {
      return interaction.editReply({ content: `No WOM groups found matching **${name}**.` });
    }

    const group = results[0];
    const key = `${interaction.guildId}:${interaction.user.id}`;
    pending.set(key, { group });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('WOM Group Found')
      .setDescription(`Do you want to link **${group.name}** to this server?\n\nThis will import all current group members as tracked players.`)
      .addFields(
        { name: 'Group ID', value: String(group.id), inline: true },
        { name: 'Members', value: String(group.memberCount ?? '?'), inline: true },
        { name: 'Score', value: String(group.score ?? '?'), inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setgroup:confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('setgroup:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};

/**
 * Handle button interactions for the setgroup flow.
 * Returns true if the interaction was handled.
 *
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @returns {Promise<boolean>}
 */
export async function handleSetgroupInteraction(interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('setgroup:')) return false;

  const key = `${interaction.guildId}:${interaction.user.id}`;

  if (customId === 'setgroup:cancel') {
    pending.delete(key);
    await interaction.update({ content: 'Group linking cancelled.', embeds: [], components: [] });
    return true;
  }

  if (customId === 'setgroup:confirm') {
    const entry = pending.get(key);
    if (!entry) {
      await interaction.update({ content: 'No pending confirmation found. Please run `/setgroup` again.', embeds: [], components: [] });
      return true;
    }

    pending.delete(key);
    const { group } = entry;

    // Defer so we can do async work
    await interaction.deferUpdate();

    let members;
    try {
      members = await getGroupMembers(group.id);
    } catch (err) {
      logger.warn(`[setgroup] getGroupMembers failed: ${err.message}`);
      await interaction.editReply({ content: `Failed to fetch group members: ${err.message}`, embeds: [], components: [] });
      return true;
    }

    // Save the group link
    queries.setWomGroup.run(interaction.guildId, { id: group.id, name: group.name, synced_at: Date.now() });

    // Import members
    let imported = 0;
    let skipped = 0;
    for (const member of members) {
      const player = member.player;
      if (!player?.id || !player?.username) continue;

      const existing = queries.getPlayerByUsernameAndGuild.get(player.username, interaction.guildId);
      if (existing) {
        skipped++;
        continue;
      }

      queries.upsertPlayer.run({ wom_id: player.id, username: player.username, guild_id: interaction.guildId });

      if (!queries.getSnapshot.get(player.id) && player.latestSnapshot?.data) {
        const snap = player.latestSnapshot.data;
        queries.upsertSnapshot.run({
          wom_id: player.id,
          username: player.username,
          snapshot_json: JSON.stringify({
            username: player.username,
            skills: snap.skills ?? {},
            bosses: snap.bosses ?? {},
            activities: snap.activities ?? {},
            achievements: [],
          }),
          updated_at: Date.now(),
        });
      }

      imported++;
    }

    logger.info(`[setgroup] Linked group "${group.name}" (id=${group.id}) to guild ${interaction.guildId}. Imported ${imported}, skipped ${skipped}.`);

    const doneEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('WOM Group Linked')
      .setDescription(`**${group.name}** is now linked to this server.`)
      .addFields(
        { name: 'Members imported', value: String(imported), inline: true },
        { name: 'Already tracked (skipped)', value: String(skipped), inline: true },
      )
      .setFooter({ text: 'Members will be kept in sync automatically each hour.' });

    await interaction.editReply({ embeds: [doneEmbed], components: [] });
    return true;
  }

  return false;
}
