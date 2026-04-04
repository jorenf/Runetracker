/**
 * src/services/tracker.js
 * Background polling loop.
 *
 * Every TRACKER_INTERVAL_MS milliseconds the tracker:
 *   1. Fetches all distinct tracked players from the database.
 *   2. Asks WiseOldMan to refresh each player's stats.
 *   3. Diffs the new snapshot against the stored one.
 *   4. For each guild that tracks the player, checks per-guild options and
 *      fires the appropriate Discord notifications.
 *   5. Persists the new snapshot so the next run has a baseline.
 *
 * A small delay (WOM_REQUEST_DELAY_MS) is inserted between WOM API calls to
 * stay within the API's rate limit.
 */

import { queries, getEffectiveOptions } from '../db/index.js';
import { updatePlayer, getPlayerAchievements } from './wom.js';
import {
  notifyLevels,
  notifyBosses,
  notifyAchievements,
  notifyClues,
  notifyNameChange,
} from './notifier.js';
import logger from '../utils/logger.js';

const INTERVAL_MS      = parseInt(process.env.TRACKER_INTERVAL_MS   ?? '300000', 10);
const REQUEST_DELAY_MS = parseInt(process.env.WOM_REQUEST_DELAY_MS  ?? '1500',   10);

/** Clue scroll activity keys present in the WOM snapshot. */
const CLUE_KEYS = [
  'clue_scrolls_all',
  'clue_scrolls_beginner',
  'clue_scrolls_easy',
  'clue_scrolls_medium',
  'clue_scrolls_hard',
  'clue_scrolls_elite',
  'clue_scrolls_master',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract a consistent snapshot summary from a WOM player object.
 * We only persist the data we need for diffing to keep the stored JSON small.
 *
 * @param {object} player  – Full WOM Player response
 * @returns {{ skills, bosses, activities, username } | null}
 */
function extractSnapshot(player) {
  const snap = player?.latestSnapshot?.data;
  if (!snap) return null;

  return {
    username:   player.username,
    skills:     snap.skills     ?? {},
    bosses:     snap.bosses     ?? {},
    activities: snap.activities ?? {},
  };
}

// ---------------------------------------------------------------------------
// Diff functions – each returns an array of change objects.
// ---------------------------------------------------------------------------

/**
 * Compare skill levels between two snapshots.
 * Only reports level increases (not raw XP changes without a level-up) to
 * avoid spammy notifications.
 */
function diffSkills(oldSnap, newSnap) {
  const changes = [];
  for (const [key, newData] of Object.entries(newSnap.skills)) {
    if (key === 'overall') continue; // total level handled implicitly
    const oldData = oldSnap.skills[key];
    if (!oldData) continue;

    const oldLevel = oldData.level ?? 0;
    const newLevel = newData.level ?? 0;
    if (newLevel > oldLevel) {
      changes.push({
        skill:    key,
        oldLevel,
        newLevel,
        oldXp: oldData.experience ?? 0,
        newXp: newData.experience ?? 0,
      });
    }
  }
  return changes;
}

/**
 * Compare boss kill counts between two snapshots.
 * -1 in WOM means "unranked / no data"; treat it as 0 for comparisons.
 */
function diffBosses(oldSnap, newSnap) {
  const changes = [];
  for (const [key, newData] of Object.entries(newSnap.bosses)) {
    const oldData = oldSnap.bosses[key];
    if (!oldData) continue;

    const oldKills = Math.max(oldData.kills ?? -1, 0);
    const newKills = Math.max(newData.kills ?? -1, 0);
    if (newKills > oldKills) {
      changes.push({ boss: key, oldKills, newKills });
    }
  }
  return changes;
}

/**
 * Compare clue scroll completions.
 * -1 means unranked; treat as 0.
 */
function diffClues(oldSnap, newSnap) {
  const changes = [];
  for (const key of CLUE_KEYS) {
    const oldData = oldSnap.activities[key];
    const newData = newSnap.activities[key];
    if (!oldData || !newData) continue;

    const oldScore = Math.max(oldData.score ?? -1, 0);
    const newScore = Math.max(newData.score ?? -1, 0);
    if (newScore > oldScore) {
      changes.push({ tier: key, oldScore, newScore });
    }
  }
  return changes;
}

/**
 * Find achievements that appear in `newList` but not in `oldList`.
 * We use `name` as the unique key since achievement names are stable.
 *
 * @param {Array} oldList  – previously stored achievements
 * @param {Array} newList  – freshly fetched achievements
 * @returns {Array}
 */
function diffAchievements(oldList, newList) {
  const oldNames = new Set((oldList ?? []).map(a => a.name));
  return newList.filter(a => !oldNames.has(a.name));
}

// ---------------------------------------------------------------------------
// Core: process a single player
// ---------------------------------------------------------------------------

/**
 * Refresh one player's data and fire notifications for all guilds that track
 * them.  Handles username changes transparently.
 *
 * @param {import('discord.js').Client} client
 * @param {object} playerRow  – Row from the `players` table (any guild)
 */
async function processPlayer(client, playerRow) {
  const { wom_id, username } = playerRow;

  // --- 1. Fetch fresh data from WOM ---
  let freshPlayer;
  try {
    freshPlayer = await updatePlayer(username);
  } catch (err) {
    logger.warn(`Failed to update player ${username} (wom_id=${wom_id}): ${err.message}`);
    return;
  }

  const freshSnap = extractSnapshot(freshPlayer);
  if (!freshSnap) {
    logger.warn(`No snapshot data for player ${username}.`);
    return;
  }

  // --- 2. Check for a username change ---
  const currentName = freshPlayer.username;
  const nameChanged = currentName.toLowerCase() !== username.toLowerCase();
  if (nameChanged) {
    logger.info(`Username change detected: ${username} → ${currentName}`);
    queries.updatePlayerUsername.run(currentName, wom_id);
  }

  // --- 3. Load the previous snapshot for diffing ---
  const storedRow   = queries.getSnapshot.get(wom_id);
  const storedSnap  = storedRow ? JSON.parse(storedRow.snapshot_json) : null;

  // Fetch fresh achievements so we can diff them.
  let freshAchievements = [];
  try {
    freshAchievements = await getPlayerAchievements(currentName);
  } catch (err) {
    logger.warn(`Could not fetch achievements for ${currentName}: ${err.message}`);
  }

  const storedAchievements = storedRow
    ? (JSON.parse(storedRow.snapshot_json).achievements ?? [])
    : [];

  // --- 4. Compute diffs (only if we have a baseline) ---
  let levelChanges  = [];
  let bossChanges   = [];
  let clueChanges   = [];
  let newAchievements = [];

  if (storedSnap) {
    levelChanges    = diffSkills(storedSnap, freshSnap);
    bossChanges     = diffBosses(storedSnap, freshSnap);
    clueChanges     = diffClues(storedSnap, freshSnap);
    newAchievements = diffAchievements(storedAchievements, freshAchievements);
  } else {
    logger.info(`First snapshot stored for player ${currentName} (wom_id=${wom_id}). Notifications start next run.`);
  }

  // --- 5. Persist the new snapshot before sending notifications ---
  //    (We update first so even if Discord calls fail, we don't re-notify.)
  queries.upsertSnapshot.run({
    wom_id,
    username:      currentName,
    snapshot_json: JSON.stringify({ ...freshSnap, achievements: freshAchievements }),
    updated_at:    Date.now(),
  });

  // --- 6. For every guild tracking this player, send applicable notifications ---
  const guildRows = queries.getGuildsForPlayer.all(wom_id);

  for (const { guild_id } of guildRows) {
    const opts = getEffectiveOptions(guild_id);

    // Username change notification (always sent when detected).
    if (nameChanged) {
      await notifyNameChange(client, guild_id, username, currentName);
    }

    if (opts.track_levels      && levelChanges.length)    await notifyLevels(client, guild_id, currentName, levelChanges);
    if (opts.track_bosses      && bossChanges.length)     await notifyBosses(client, guild_id, currentName, bossChanges);
    if (opts.track_achievements && newAchievements.length) await notifyAchievements(client, guild_id, currentName, newAchievements);
    if (opts.track_clues       && clueChanges.length)     await notifyClues(client, guild_id, currentName, clueChanges);
  }
}

// ---------------------------------------------------------------------------
// Main tracking loop
// ---------------------------------------------------------------------------

/**
 * Start the background tracking interval.
 * Should be called once the Discord client is ready.
 *
 * @param {import('discord.js').Client} client
 */
export function startTracker(client) {
  logger.info(`Tracker started. Poll interval: ${INTERVAL_MS / 1000}s, request delay: ${REQUEST_DELAY_MS}ms`);

  const runCycle = async () => {
    logger.info('--- Tracker cycle start ---');

    // Deduplicate: each WOM player ID only needs updating once even if tracked
    // in multiple guilds.
    const allPlayers = queries.getAllPlayers.all();
    const seen = new Set();
    const uniquePlayers = allPlayers.filter(p => {
      if (seen.has(p.wom_id)) return false;
      seen.add(p.wom_id);
      return true;
    });

    logger.info(`Processing ${uniquePlayers.length} unique tracked player(s)…`);

    for (const playerRow of uniquePlayers) {
      await processPlayer(client, playerRow);
      // Throttle to avoid hammering the WOM API.
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    }

    logger.info('--- Tracker cycle complete ---');
  };

  // Run once immediately, then on the configured interval.
  runCycle().catch(err => logger.error('Tracker cycle error:', err));
  setInterval(() => {
    runCycle().catch(err => logger.error('Tracker cycle error:', err));
  }, INTERVAL_MS);
}
