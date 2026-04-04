/**
 * src/events/interactionCreate.js
 * Routes incoming Discord interactions to the correct command handler.
 * Handles slash commands (ChatInputCommand) and message component interactions
 * (buttons, select menus) for the setup wizard and setgroup flow.
 */

import logger from '../utils/logger.js';

export default {
  name: 'interactionCreate',
  once: false,

  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client}      client
   */
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Received unknown command: ${interaction.commandName}`);
        return interaction.reply({
          content: 'Unknown command.',
          ephemeral: true,
        });
      }

      // Only allow commands inside a guild (DMs are not supported).
      if (!interaction.guildId) {
        return interaction.reply({
          content: 'This bot only works inside Discord servers.',
          ephemeral: true,
        });
      }

      try {
        logger.debug(`[${interaction.guildId}] /${interaction.commandName} by ${interaction.user.tag}`);
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Error executing /${interaction.commandName}:`, err);

        const errorPayload = {
          content: 'An error occurred while running this command. Please try again later.',
          ephemeral: true,
        };

        // If we already replied or deferred, use editReply.
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }

      return;
    }

    if (interaction.isMessageComponent()) {
      // Dynamically import to avoid circular deps
      const { handleWizardInteraction } = await import('../commands/setup.js');
      const { handleSetgroupInteraction } = await import('../commands/setgroup.js');

      try {
        if (await handleWizardInteraction(interaction)) return;
        if (await handleSetgroupInteraction(interaction)) return;
      } catch (err) {
        logger.error('Error handling component interaction:', err);
        const payload = { content: 'An error occurred.', embeds: [], components: [] };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(payload).catch(() => {});
        } else {
          await interaction.update(payload).catch(() => {});
        }
      }
    }
  },
};
