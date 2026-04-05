/**
 * src/commands/testdrop.js
 * /testdrop – simulate a loot drop for testing purposes.
 * Admin only. Bypasses the HTTP webhook and injects a drop directly.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { queries } from '../db/index.js';
import { isAdmin } from '../utils/admin.js';
import { priceByName } from '../services/prices.js';
import { buildBigDropEmbed } from '../utils/embeds.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testdrop')
    .setDescription('Simulate a loot drop for testing. Admin only.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Item name (e.g. "Twisted bow", "Bandos chestplate")')
        .setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Player name (defaults to your Discord username)')
        .setRequired(false),
    )
    .addIntegerOption(opt =>
      opt.setName('value')
        .setDescription('Override GP value (leave empty to auto-lookup from OSRS Wiki)')
        .setMinValue(0)
        .setRequired(false),
    )
    .addStringOption(opt =>
      opt.setName('source')
        .setDescription('Boss or activity name (e.g. "Chambers of Xeric")')
        .setRequired(false),
    )
    .addIntegerOption(opt =>
      opt.setName('quantity')
        .setDescription('Quantity (default: 1)')
        .setMinValue(1)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: 'Admin only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    const itemName  = interaction.options.getString('item');
    const player    = interaction.options.getString('player') ?? interaction.user.username;
    const source    = interaction.options.getString('source') ?? 'Test Drop';
    const quantity  = interaction.options.getInteger('quantity') ?? 1;
    const override  = interaction.options.getInteger('value');

    // Resolve GE value
    let value = override ?? 0;
    if (override === null) {
      try {
        const unitPrice = await priceByName(itemName);
        value = unitPrice * quantity;
      } catch {
        value = 0;
      }
    }

    const entry = {
      player,
      item_name: itemName,
      item_id:   null,
      qty:       quantity,
      value,
      source,
      kc:        null,
      ts:        Date.now(),
    };

    // Store the drop
    queries.addLootEntry.run(interaction.guildId, entry);
    logger.info(`[testdrop] Injected test drop: ${player} | ${itemName} x${quantity} = ${value.toLocaleString()} gp`);

    // Always show the drop embed (ignore threshold for test)
    const embed = buildBigDropEmbed(player, entry);

    // Also post to loot channel if configured
    const settings = queries.getLootSettings.get(interaction.guildId);
    const notifyChannelId = settings?.loot_channel_id;
    if (notifyChannelId && notifyChannelId !== interaction.channelId) {
      try {
        const ch = await interaction.client.channels.fetch(notifyChannelId);
        await ch.send({ embeds: [embed] });
      } catch {
        // non-fatal
      }
    }

    return interaction.editReply({
      content: `✅ Test drop injected. Use \`/loot\` and \`/topdrop\` to verify it shows up.`,
      embeds: [embed],
    });
  },
};
