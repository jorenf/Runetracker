import { queries } from '../db/index.js';
import logger from '../utils/logger.js';

const ANNOUNCEMENT_ID = 'runetracker-updates-2026-11-v1';
const ANNOUNCEMENT = [
  '**Runetracker has been updated!**',
  '',
  'We’ve made a number of improvements to make Runetracker easier and more reliable:',
  '- A more interactive setup flow and a clearer settings dashboard.',
  '- Improved spam filtering and notification controls.',
  '- Official OSRS Hiscores support, with Wise Old Man fallback and rate-limit handling.',
  '- Corrected boss kill counts.',
  '- **Automatic name-change support:** tracking follows a player’s WOM ID when Wise Old Man links the new name to the existing profile.',
  '- Slash commands now sync automatically, including cleanup of outdated commands.',
  '',
  'Your existing tracked players remain tracked.',
  '',
  'Visit **https://runetracker.icu** and join the community at **https://runetracker.icu/discord**. Thanks for using Runetracker!',
].join('\n');

export async function postReleaseAnnouncement(client) {
  let sent = 0;
  let failed = 0;
  const guilds = queries.getAllGuilds.all();

  for (const { guild_id, channel_id } of guilds) {
    if (!channel_id || !client.guilds.cache.has(guild_id)) continue;
    if (!queries.claimAnnouncement.run(guild_id, ANNOUNCEMENT_ID)) continue;

    let message;
    try {
      const channel = await client.channels.fetch(channel_id);
      if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
        throw new Error(`Channel ${channel_id} is not a text channel.`);
      }

      message = await channel.send(ANNOUNCEMENT);
    } catch (error) {
      try {
        queries.releaseAnnouncementClaim.run(guild_id, ANNOUNCEMENT_ID);
      } catch (releaseError) {
        logger.error(`[Announcement] Could not release failed-send claim for guild ${guild_id}: ${releaseError.message}`);
      }
      failed += 1;
      logger.error(`[Announcement] Could not send release update to guild ${guild_id}: ${error.message}`);
      continue;
    }

    sent += 1;
    try {
      queries.completeAnnouncement.run(guild_id, ANNOUNCEMENT_ID, message.id);
      logger.info(`[Announcement] Release update sent to guild ${guild_id}.`);
    } catch (error) {
      logger.error(`[Announcement] Release update was sent to guild ${guild_id}, but its completion could not be saved; keeping the claim to prevent a duplicate: ${error.message}`);
    }
  }

  logger.info(`[Announcement] Release update sent to ${sent} guild(s); ${failed} send(s) failed.`);
  return { sent, failed };
}
