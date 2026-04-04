/**
 * src/commands/setup.js
 * /setup — interactive multi-step wizard for bot configuration.
 * Requires ManageGuild permission.
 *
 * Steps:
 *   1. Mode selection (Individual Players | WOM Clan | Both)
 *   2. Channel selection (ChannelSelectMenu, text channels only)
 *   3. Tracking options (toggle buttons) + Finish
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { queries } from '../db/index.js';
import logger from '../utils/logger.js';

const EMBED_COLOR = 0xC8A96A;
const DONE_COLOR  = 0x57F287;

/** Active wizard sessions: `${guildId}:${userId}` → { step, mode, channelId, opts } */
const sessions = new Map();

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Run the interactive setup wizard for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const key = `${interaction.guildId}:${interaction.user.id}`;
    // Clear any stale session
    sessions.delete(key);

    sessions.set(key, {
      step: 1,
      mode: null,
      channelId: null,
      opts: { levels: true, bosses: true, achievements: true, clues: true },
    });

    const embed = buildStep1Embed();
    const row   = buildModeRow();

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};

// ---------------------------------------------------------------------------
// Component interaction handler
// ---------------------------------------------------------------------------

/**
 * Handle button/select interactions for the setup wizard.
 * Returns true if the interaction was handled.
 *
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @returns {Promise<boolean>}
 */
export async function handleWizardInteraction(interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('setup:')) return false;

  const key = `${interaction.guildId}:${interaction.user.id}`;
  const session = sessions.get(key);

  // --- Cancel ---
  if (customId === 'setup:cancel') {
    sessions.delete(key);
    await interaction.update({ content: 'Setup cancelled.', embeds: [], components: [] });
    return true;
  }

  // --- Mode selection (step 1 → 2) ---
  if (customId.startsWith('setup:mode:')) {
    const modeMap = {
      'setup:mode:players': 'players',
      'setup:mode:group':   'group',
      'setup:mode:both':    'both',
    };
    const mode = modeMap[customId];

    if (!session) {
      await interaction.update({ content: 'Session expired. Please run `/setup` again.', embeds: [], components: [] });
      return true;
    }

    session.mode = mode;
    session.step = 2;

    const embed = buildStep2Embed();
    const row   = buildChannelSelectRow();

    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  // --- Channel selection (step 2 → 3) ---
  if (customId === 'setup:channel') {
    if (!session) {
      await interaction.update({ content: 'Session expired. Please run `/setup` again.', embeds: [], components: [] });
      return true;
    }

    session.channelId = interaction.values[0];
    session.step = 3;

    const embed = buildStep3Embed(session.opts);
    const rows  = buildOptionsRows(session.opts);

    await interaction.update({ embeds: [embed], components: rows });
    return true;
  }

  // --- Toggle tracking options (step 3) ---
  if (customId.startsWith('setup:toggle:')) {
    if (!session) {
      await interaction.update({ content: 'Session expired. Please run `/setup` again.', embeds: [], components: [] });
      return true;
    }

    const key2opt = {
      'setup:toggle:levels':       'levels',
      'setup:toggle:bosses':       'bosses',
      'setup:toggle:achievements': 'achievements',
      'setup:toggle:clues':        'clues',
    };
    const optKey = key2opt[customId];
    if (optKey) session.opts[optKey] = !session.opts[optKey];

    const embed = buildStep3Embed(session.opts);
    const rows  = buildOptionsRows(session.opts);

    await interaction.update({ embeds: [embed], components: rows });
    return true;
  }

  // --- Finish ---
  if (customId === 'setup:finish') {
    if (!session) {
      await interaction.update({ content: 'Session expired. Please run `/setup` again.', embeds: [], components: [] });
      return true;
    }

    const { mode, channelId, opts } = session;

    if (!channelId) {
      await interaction.update({ content: 'No channel selected. Please run `/setup` again.', embeds: [], components: [] });
      sessions.delete(key);
      return true;
    }

    // Persist to DB
    queries.upsertGuild.run({ guild_id: interaction.guildId, channel_id: channelId });
    queries.upsertTrackingOptions.run({
      guild_id:           interaction.guildId,
      track_levels:       opts.levels       ? 1 : 0,
      track_bosses:       opts.bosses       ? 1 : 0,
      track_achievements: opts.achievements ? 1 : 0,
      track_clues:        opts.clues        ? 1 : 0,
    });

    sessions.delete(key);
    logger.info(`[Setup] Guild ${interaction.guildId} configured by ${interaction.user.tag} — mode=${mode} channel=${channelId}`);

    const embed = buildDoneEmbed(mode, channelId, opts);
    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Embed builders
// ---------------------------------------------------------------------------

function buildStep1Embed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('⚙️ Muskebeers Setup — Step 1 of 3')
    .setDescription(
      'How would you like to track players?\n\n' +
      '**Individual Players** — manually add players with `/track <username>`\n' +
      '**WOM Clan** — link a Wise Old Man group and auto-import its members\n' +
      '**Both** — link a group AND allow manual additions',
    );
}

function buildStep2Embed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('⚙️ Muskebeers Setup — Step 2 of 3')
    .setDescription('Select the channel where tracking notifications will be posted.');
}

function buildStep3Embed(opts) {
  const status = (v) => (v ? '✅ On' : '❌ Off');
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('⚙️ Muskebeers Setup — Step 3 of 3')
    .setDescription('Toggle which events you want to be notified about, then press **Finish**.')
    .addFields(
      { name: 'Level ups',     value: status(opts.levels),       inline: true },
      { name: 'Boss kills',    value: status(opts.bosses),       inline: true },
      { name: 'Achievements',  value: status(opts.achievements), inline: true },
      { name: 'Clue scrolls',  value: status(opts.clues),        inline: true },
    );
}

function buildDoneEmbed(mode, channelId, opts) {
  const enabled = [];
  if (opts.levels)       enabled.push('Level ups');
  if (opts.bosses)       enabled.push('Boss kills');
  if (opts.achievements) enabled.push('Achievements');
  if (opts.clues)        enabled.push('Clue scrolls');

  const nextSteps = [];
  if (mode === 'group' || mode === 'both') nextSteps.push('Use `/setgroup <name>` to import your WOM clan.');
  if (mode === 'players' || mode === 'both') nextSteps.push('Use `/track <username>` to add players.');

  return new EmbedBuilder()
    .setColor(DONE_COLOR)
    .setTitle('Setup complete!')
    .addFields(
      { name: 'Notifications channel', value: `<#${channelId}>`, inline: false },
      { name: 'Tracking mode', value: mode, inline: true },
      { name: 'Enabled notifications', value: enabled.length ? enabled.join(', ') : 'None', inline: false },
      { name: 'Next steps', value: nextSteps.length ? nextSteps.join('\n') : 'You are all set!', inline: false },
    );
}

// ---------------------------------------------------------------------------
// Component builders
// ---------------------------------------------------------------------------

function buildModeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:mode:players').setLabel('Individual Players').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:mode:group').setLabel('WOM Clan').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:mode:both').setLabel('Both').setStyle(ButtonStyle.Secondary),
  );
}

function buildChannelSelectRow() {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('setup:channel')
      .setPlaceholder('Select a text channel…')
      .addChannelTypes(ChannelType.GuildText),
  );
}

function buildOptionsRows(opts) {
  const toggleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:toggle:levels')
      .setLabel(`Level ups: ${opts.levels ? 'On' : 'Off'}`)
      .setStyle(opts.levels ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle:bosses')
      .setLabel(`Boss kills: ${opts.bosses ? 'On' : 'Off'}`)
      .setStyle(opts.bosses ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle:achievements')
      .setLabel(`Achievements: ${opts.achievements ? 'On' : 'Off'}`)
      .setStyle(opts.achievements ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle:clues')
      .setLabel(`Clue scrolls: ${opts.clues ? 'On' : 'Off'}`)
      .setStyle(opts.clues ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:finish').setLabel('Finish').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );

  return [toggleRow, actionRow];
}
