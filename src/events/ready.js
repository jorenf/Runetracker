/**
 * src/events/ready.js
 * Fires once after the Discord client has logged in and is ready to operate.
 */

import logger from '../utils/logger.js';

export default {
  name:  'ready',
  once:  true,

  /**
   * @param {import('discord.js').Client} client
   */
  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (${client.user.id}).`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s).`);

    // Set a custom status so server members can see the bot is active.
    client.user.setActivity('Old School RuneScape', { type: 3 /* Watching */ });
  },
};
