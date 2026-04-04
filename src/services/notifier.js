/**
 * src/services/notifier.js
 * Responsible for sending Discord embed messages to the correct channel.
 *
 * Every public function accepts a `client` (Discord.js Client) and a
 * `guildId` so it can look up the configured announcement channel.
 */

import { queries } from '../db/index.js';
import {
  buildLevelEmbed,
  buildBossEmbed,
  buildAchievementEmbed,
  buildClueEmbed,
  buildNameChangeEmbed,
} from '../utils/embeds.js';
import logger from '../utils/logger.js';

/**
 * Resolve the configured announcement channel for a guild.
 * Returns null (and logs a warning) if not configured or not accessible.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function getAnnouncementChannel(client, guildId) {
  const row = queries.getGuild.get(guildId);
  if (!row?.channel_id) {
    logger.warn(`Guild ${guildId} has no announcement channel configured.`);
    return null;
  }

  try {
    return await client.channels.fetch(row.channel_id);
  } catch (err) {
    logger.error(`Cannot fetch channel ${row.channel_id} for guild ${guildId}: ${err.message}`);
    return null;
  }
}

/**
 * Send one or more embeds to a guild's announcement channel.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {import('discord.js').EmbedBuilder[]} embeds
 */
async function sendEmbeds(client, guildId, embeds) {
  if (!embeds.length) return;

  const channel = await getAnnouncementChannel(client, guildId);
  if (!channel) return;

  // Discord allows up to 10 embeds per message; chunk if needed.
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    try {
      await channel.send({ embeds: chunk });
    } catch (err) {
      logger.error(`Failed to send embeds to channel ${channel.id}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public notification helpers
// ---------------------------------------------------------------------------

export async function notifyLevels(client, guildId, displayName, changes) {
  if (!changes.length) return;
  const embed = buildLevelEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[${guildId}] Sent level notification for ${displayName} (${changes.length} skill(s)).`);
}

export async function notifyBosses(client, guildId, displayName, changes) {
  if (!changes.length) return;
  const embed = buildBossEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[${guildId}] Sent boss notification for ${displayName} (${changes.length} boss(es)).`);
}

export async function notifyAchievements(client, guildId, displayName, newAchievements) {
  if (!newAchievements.length) return;
  // Split into groups of 25 fields (Discord embed field limit).
  const chunkSize = 25;
  for (let i = 0; i < newAchievements.length; i += chunkSize) {
    const chunk = newAchievements.slice(i, i + chunkSize);
    const embed = buildAchievementEmbed(displayName, chunk);
    await sendEmbeds(client, guildId, [embed]);
  }
  logger.info(`[${guildId}] Sent achievement notification for ${displayName} (${newAchievements.length}).`);
}

export async function notifyClues(client, guildId, displayName, changes) {
  if (!changes.length) return;
  const embed = buildClueEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[${guildId}] Sent clue scroll notification for ${displayName} (${changes.length} tier(s)).`);
}

export async function notifyNameChange(client, guildId, oldName, newName) {
  const embed = buildNameChangeEmbed(oldName, newName);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[${guildId}] Sent name-change notification: ${oldName} → ${newName}`);
}
