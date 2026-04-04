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
  buildLevel99Embed,
  buildTotalLevelEmbed,
  buildBossKCMilestoneEmbed,
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
  if (!changes?.length) return;
  // One embed per skill – sent together in one message (same timestamp).
  const embeds = changes.map(c => buildLevelEmbed(displayName, c));
  await sendEmbeds(client, guildId, embeds);
  logger.info(`[Notifier] Level-up sent for ${displayName} in guild ${guildId} (${changes.length} skill(s))`);
}

export async function notifyBosses(client, guildId, displayName, changes) {
  if (!changes?.length) return;
  // Boss kills grouped in one card (ScapeBot style).
  await sendEmbeds(client, guildId, [buildBossEmbed(displayName, changes)]);
  logger.info(`[Notifier] Boss kill sent for ${displayName} in guild ${guildId} (${changes.length} boss(es))`);
}

export async function notifyAchievements(client, guildId, displayName, newAchievements) {
  if (!newAchievements?.length) return;
  // One embed per achievement, max 10 per message.
  const embeds = newAchievements.map(a => buildAchievementEmbed(displayName, a));
  await sendEmbeds(client, guildId, embeds);
  logger.info(`[Notifier] Achievement sent for ${displayName} in guild ${guildId} (${newAchievements.length})`);
}

export async function notifyClues(client, guildId, displayName, changes) {
  if (!changes?.length) return;
  // One embed per clue tier.
  const embeds = changes.map(c => buildClueEmbed(displayName, c));
  await sendEmbeds(client, guildId, embeds);
  logger.info(`[Notifier] Clue scroll sent for ${displayName} in guild ${guildId} (${changes.length} tier(s))`);
}

export async function notifyNameChange(client, guildId, oldName, newName) {
  const embed = buildNameChangeEmbed(oldName, newName);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Name change sent in guild ${guildId}: ${oldName} → ${newName}`);
}

export async function notifyLevel99(client, guildId, displayName, skill) {
  const embed = buildLevel99Embed(displayName, skill);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Level 99 sent for ${displayName} – ${skill} in guild ${guildId}`);
}

export async function notifyTotalLevelMilestone(client, guildId, displayName, totalLevel) {
  const embed = buildTotalLevelEmbed(displayName, totalLevel);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Total level ${totalLevel} sent for ${displayName} in guild ${guildId}`);
}

export async function notifyBossKCMilestone(client, guildId, displayName, boss, kc) {
  const embed = buildBossKCMilestoneEmbed(displayName, boss, kc);
  await sendEmbeds(client, guildId, [embed]);
  logger.info(`[Notifier] Boss KC milestone ${kc} (${boss}) sent for ${displayName} in guild ${guildId}`);
}
