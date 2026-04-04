/**
 * src/services/notifier.js
 * Sends Discord embed messages to the configured announcement channel.
 *
 * Every notify* function has an early-return guard so it is safe to call even
 * when the changes array is empty – nothing will be sent.
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAnnouncementChannel(client, guildId) {
  const row = queries.getGuild.get(guildId);
  if (!row?.channel_id) {
    logger.warn(`[Notifier] Guild ${guildId} has no announcement channel set.`);
    return null;
  }
  try {
    return await client.channels.fetch(row.channel_id);
  } catch (err) {
    logger.error(`[Notifier] Cannot fetch channel ${row.channel_id} for guild ${guildId}: ${err.message}`);
    return null;
  }
}

async function sendEmbeds(client, guildId, embeds) {
  if (!embeds.length) return;

  const channel = await getAnnouncementChannel(client, guildId);
  if (!channel) return;

  // Discord allows max 10 embeds per message.
  for (let i = 0; i < embeds.length; i += 10) {
    try {
      await channel.send({ embeds: embeds.slice(i, i + 10) });
    } catch (err) {
      logger.error(`[Notifier] Failed to send embed to channel ${channel.id}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public notification functions
// Each function silently no-ops if the changes array is empty.
// ---------------------------------------------------------------------------

export async function notifyLevels(client, guildId, displayName, changes) {
  if (!changes?.length) return; // ← spam guard
  const embed = buildLevelEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Level-up sent for ${displayName} in guild ${guildId} (${changes.length} skill(s))`);
}

export async function notifyBosses(client, guildId, displayName, changes) {
  if (!changes?.length) return;
  const embed = buildBossEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Boss kill sent for ${displayName} in guild ${guildId} (${changes.length} boss(es))`);
}

export async function notifyAchievements(client, guildId, displayName, newAchievements) {
  if (!newAchievements?.length) return;
  // Discord embed description limit: chunk into groups of 25 lines.
  for (let i = 0; i < newAchievements.length; i += 25) {
    const embed = buildAchievementEmbed(displayName, newAchievements.slice(i, i + 25));
    await sendEmbeds(client, guildId, [embed]);
  }
  logger.info(`[Notifier] Achievement sent for ${displayName} in guild ${guildId} (${newAchievements.length})`);
}

export async function notifyClues(client, guildId, displayName, changes) {
  if (!changes?.length) return;
  const embed = buildClueEmbed(displayName, changes);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Clue scroll sent for ${displayName} in guild ${guildId} (${changes.length} tier(s))`);
}

export async function notifyNameChange(client, guildId, oldName, newName) {
  const embed = buildNameChangeEmbed(oldName, newName);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Name change sent in guild ${guildId}: ${oldName} → ${newName}`);
}
