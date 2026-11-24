/**
 * /settings — view and manage this server's Runetracker configuration.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { queries, getEffectiveOptions } from '../db/index.js';
import { COLORS } from '../utils/embeds.js';
import { isAdmin } from '../utils/admin.js';

const CATEGORY_MAP = {
  levels: 'track_levels',
  bosses: 'track_bosses',
  achievements: 'track_achievements',
  clues: 'track_clues',
};

const CATEGORY_NAMES = {
  levels: 'Level ups',
  bosses: 'Boss kills',
  achievements: 'Achievements',
  clues: 'Clue scrolls',
};

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View and manage this server’s Runetracker settings.'),

  async execute(interaction) {
    return interaction.reply({
      ...buildSettingsMessage(interaction),
      ephemeral: true,
    });
  },
};

export async function handleSettingsInteraction(interaction) {
  if (interaction.isModalSubmit?.() && interaction.customId === 'settings:spam:submit') {
    return handleSpamModal(interaction);
  }
  if (!interaction.isMessageComponent?.() || !interaction.customId.startsWith('settings:')) return false;

  const { customId } = interaction;
  if (customId === 'settings:spam') {
    if (!isAdmin(interaction)) return deny(interaction);
    await interaction.showModal(buildSpamModal(interaction.guildId));
    return true;
  }

  if (customId === 'settings:admins') {
    if (!isAdmin(interaction)) return deny(interaction);
    await interaction.update(buildAdminsMessage(interaction.guildId));
    return true;
  }

  if (customId === 'settings:home') {
    await interaction.update(buildSettingsMessage(interaction));
    return true;
  }

  if (customId === 'settings:channel') {
    if (!isAdmin(interaction)) return deny(interaction);
    const channelId = interaction.values[0];
    const channel = await interaction.guild.channels.fetch(channelId);
    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
    const permissions = channel?.permissionsFor(botMember);
    if (!permissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])) {
      await interaction.update({
        ...buildSettingsMessage(interaction),
        content: 'I need **View Channel**, **Send Messages**, and **Embed Links** in that channel. Choose another channel or update my permissions.',
      });
      return true;
    }

    queries.upsertGuild.run({ guild_id: interaction.guildId, channel_id: channelId });
    await interaction.update(buildSettingsMessage(interaction));
    return true;
  }

  if (customId.startsWith('settings:toggle:')) {
    if (!isAdmin(interaction)) return deny(interaction);
    const category = customId.slice('settings:toggle:'.length);
    const column = CATEGORY_MAP[category];
    if (!column) return false;

    const current = getEffectiveOptions(interaction.guildId);
    queries.upsertTrackingOptions.run({
      guild_id: interaction.guildId,
      track_levels: current.track_levels,
      track_bosses: current.track_bosses,
      track_achievements: current.track_achievements,
      track_clues: current.track_clues,
      [column]: current[column] ? 0 : 1,
    });
    await interaction.update(buildSettingsMessage(interaction));
    return true;
  }

  return false;
}

function buildSettingsMessage(interaction) {
  const guildId = interaction.guildId;
  const guildRow = queries.getGuild.get(guildId);
  const opts = getEffectiveOptions(guildId);
  const players = queries.getPlayersByGuild.all(guildId);
  const admins = queries.getGuildAdmins.all(guildId);
  const status = (value) => value ? '✅ On' : '⏸️ Off';

  const embed = new EmbedBuilder()
    .setColor(COLORS.nameChange)
    .setTitle(`Runetracker Settings · ${interaction.guild?.name ?? 'Server'}`)
    .setDescription('Manage notifications and spam controls here. Changes apply immediately.')
    .addFields(
      { name: '📢 Notification channel', value: guildRow?.channel_id ? `<#${guildRow.channel_id}>` : 'Not set — choose a channel below.', inline: false },
      {
        name: '🔔 Notifications',
        value: Object.entries(CATEGORY_MAP)
          .map(([key, column]) => `${status(opts[column])} **${CATEGORY_NAMES[key]}**`)
          .join('\n'),
        inline: true,
      },
      {
        name: '🧹 Spam filter',
        value: `Level threshold: **${opts.min_level_notify}**\nBoss KC threshold: **${opts.min_boss_kc_notify}**\nCooldown: **${opts.cooldown_hours ? `${opts.cooldown_hours}h` : 'Off'}**`,
        inline: true,
      },
      {
        name: `👥 Tracked players (${players.length})`,
        value: players.length
          ? players.slice(0, 12).map(player => `• ${player.username}`).join('\n') + (players.length > 12 ? `\n…and ${players.length - 12} more` : '')
          : 'No players tracked yet.',
        inline: false,
      },
      {
        name: `🔑 Bot admins (${admins.length})`,
        value: admins.length ? admins.slice(0, 10).map(admin => `<@${admin.user_id}>`).join(', ') : 'None — users with Manage Server can manage settings.',
        inline: false,
      },
    )
    .setFooter({ text: 'Admin controls require Manage Server or bot-admin access.' });

  return { content: '', embeds: [embed], components: buildSettingsComponents(opts) };
}

function buildSettingsComponents(opts) {
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings:channel')
      .setPlaceholder('Choose notification channel')
      .addChannelTypes(ChannelType.GuildText),
  );
  const toggles = new ActionRowBuilder().addComponents(
    ...Object.entries(CATEGORY_MAP).map(([key, column]) =>
      new ButtonBuilder()
        .setCustomId(`settings:toggle:${key}`)
        .setLabel(`${CATEGORY_NAMES[key]}: ${opts[column] ? 'On' : 'Off'}`)
        .setStyle(opts[column] ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('settings:spam').setLabel('Edit spam filter').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('settings:admins').setLabel('View admin access').setStyle(ButtonStyle.Secondary),
  );
  return [channelRow, toggles, actions];
}

function buildSpamModal(guildId) {
  const options = getEffectiveOptions(guildId);
  return new ModalBuilder()
    .setCustomId('settings:spam:submit')
    .setTitle('Spam filter thresholds')
    .addComponents(
      textInput('min_level', 'Minimum level (0–126)', options.min_level_notify),
      textInput('min_boss_kc', 'Minimum boss KC (0 or more)', options.min_boss_kc_notify),
      textInput('cooldown', 'Cooldown hours (0–168; decimals allowed)', options.cooldown_hours),
    );
}

function textInput(id, label, value) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setValue(String(value))
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(10),
  );
}

async function handleSpamModal(interaction) {
  if (!isAdmin(interaction)) return deny(interaction);
  const bounds = {
    min_level: { max: 126, key: 'min_level_notify' },
    min_boss_kc: { max: 2_147_483_647, key: 'min_boss_kc_notify' },
    cooldown: { max: 168, key: 'cooldown_hours' },
  };
  const updates = {};
  for (const [field, { max, key }] of Object.entries(bounds)) {
    const raw = interaction.fields.getTextInputValue(field).trim();
    if (!raw) continue;
    const pattern = field === 'cooldown' ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
    const value = Number(raw);
    if (!pattern.test(raw) || !Number.isFinite(value) || value > max) {
      await interaction.reply({
        content: `Enter a valid value between 0 and ${max} for **${field}**, or leave it blank to keep the current value.`,
        ephemeral: true,
      });
      return true;
    }
    updates[key] = value;
  }

  if (!Object.keys(updates).length) {
    await interaction.reply({ content: 'No spam-filter settings were changed.', ephemeral: true });
    return true;
  }

  queries.setSpamFilter.run(interaction.guildId, updates);
  const updatedMessage = buildSettingsMessage(interaction);
  if (interaction.isFromMessage?.()) {
    await interaction.update(updatedMessage);
  } else {
    await interaction.reply({ ...updatedMessage, ephemeral: true });
  }
  return true;
}

function buildAdminsMessage(guildId) {
  const admins = queries.getGuildAdmins.all(guildId);
  const description = admins.length
    ? admins.map(admin => `• <@${admin.user_id}>`).join('\n')
    : 'No custom bot admins are configured.';
  const embed = new EmbedBuilder()
    .setColor(COLORS.nameChange)
    .setTitle('Bot admin access')
    .setDescription(`${description}\n\nManage access with \`/setadmin add\` and \`/setadmin remove\`. Users with **Manage Server** retain access.`);
  return {
    content: '',
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('settings:home').setLabel('Back to settings').setStyle(ButtonStyle.Secondary),
    )],
  };
}

async function deny(interaction) {
  await interaction.reply({
    content: 'You need **Manage Server** permission or bot-admin access to change settings.',
    ephemeral: true,
  });
  return true;
}
