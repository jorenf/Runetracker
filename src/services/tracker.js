/**
 * src/services/tracker.js
 * Background polling loop + manual trigger exports.
 *
 * Automatic cycle (every TRACKER_INTERVAL_MS):
 *   1. Deduplicates all tracked players across guilds.
 *   2. Asks WiseOldMan to refresh each player.
 *   3. Diffs the new snapshot against the stored baseline.
 *   4. Fires Discord notifications per guild based on tracking options.
 *   5. Persists the new snapshot.
 *
 * Manual triggers (used by /checkupdate):
 *   triggerPlayer(username, guildId) – process one specific player
 *   triggerFullCycle()               – run the full cycle immediately
 *
 * Tracker state (used by /status):
 *   getTrackerState() – returns last/next cycle timestamps + running flag
 */

import { queries, getEffectiveOptions } from '../db/index.js';
import { updatePlayer, getPlayerAchievements, getGroupMembers } from './wom.js';
import {
  notifyLevels,
  notifyBosses,
  notifyAchievements,
  notifyClues,
  notifyNameChange,
  notifyLevel99,
  notifyTotalLevelMilestone,
  notifyBossKCMilestone,
} from './notifier.js';
import logger from '../utils/logger.js';

/** Total level values that trigger a special milestone notification. */
const TOTAL_LEVEL_MILESTONES = [500, 750, 1000, 1250, 1500, 1750, 2000, 2277];

/** Boss KC values that trigger a milestone notification. */
const BOSS_KC_MILESTONES = [100, 250, 500, 1000, 2000, 5000, 10000];

const INTERVAL_MS = parseInt(process.env.TRACKER_INTERVAL_MS ?? '300000', 10);

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
// Module-level state (readable via getTrackerState)
// ---------------------------------------------------------------------------

let _client       = null;  // stored so manual triggers can reuse it
let _lastCycleAt  = null;  // Date of last completed cycle
let _nextCycleAt  = null;  // Date of next scheduled cycle
let _cycleRunning = false; // guard against concurrent runs

/**
 * Returns a snapshot of the current tracker state.
 * Used by the /status command.
 */
export function getTrackerState() {
  return {
    lastCycleAt:  _lastCycleAt,
    nextCycleAt:  _nextCycleAt,
    cycleRunning: _cycleRunning,
    intervalMs:   INTERVAL_MS,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Diff functions
// ---------------------------------------------------------------------------

function diffSkills(oldSnap, newSnap) {
  const changes = [];
  for (const [key, newData] of Object.entries(newSnap.skills)) {
    if (key === 'overall') continue;
    const oldData  = oldSnap.skills[key];
    if (!oldData) continue;
    const oldLevel = oldData.level ?? 0;
    const newLevel = newData.level ?? 0;
    if (newLevel > oldLevel) {
      changes.push({
        skill: key,
        oldLevel,
        newLevel,
        oldXp: oldData.experience ?? 0,
        newXp: newData.experience ?? 0,
      });
    }
  }
  return changes;
}

function diffBosses(oldSnap, newSnap) {
  const changes = [];
  for (const [key, newData] of Object.entries(newSnap.bosses)) {
    const oldData  = oldSnap.bosses[key];
    if (!oldData) continue;
    const oldKills = Math.max(oldData.kills ?? -1, 0);
    const newKills = Math.max(newData.kills ?? -1, 0);
    if (newKills > oldKills) {
      changes.push({ boss: key, oldKills, newKills });
    }
  }
  return changes;
}

function diffClues(oldSnap, newSnap) {
  const changes = [];
  for (const key of CLUE_KEYS) {
    const oldData  = oldSnap.activities[key];
    const newData  = newSnap.activities[key];
    if (!oldData || !newData) continue;
    const oldScore = Math.max(oldData.score ?? -1, 0);
    const newScore = Math.max(newData.score ?? -1, 0);
    if (newScore > oldScore) {
      changes.push({ tier: key, oldScore, newScore });
    }
  }
  return changes;
}

function diffAchievements(oldList, newList) {
  const oldNames = new Set((oldList ?? []).map(a => a.name));
  return newList.filter(a => !oldNames.has(a.name));
}

// ---------------------------------------------------------------------------
// Core: process a single player
// Returns a result object so manual triggers can report back to the user.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ProcessResult
 * @property {boolean} success
 * @property {string}  displayName
 * @property {boolean} firstRun      – true if this was the first snapshot (no diff yet)
 * @property {boolean} nameChanged
 * @property {string}  [oldName]
 * @property {{ levels:number, bosses:number, achievements:number, clues:number }} changes
 * @property {string}  [error]
 */

/**
 * Refresh one player and send notifications to all guilds tracking them.
 *
 * @param {import('discord.js').Client} client
 * @param {object} playerRow  – { wom_id, username, guild_id }
 * @returns {Promise<ProcessResult>}
 */
async function processPlayer(client, playerRow) {
  const { wom_id, username } = playerRow;

  logger.info(`[Tracker] Checking player: ${username} (wom_id=${wom_id})`);

  // 1. Refresh via WOM
  let freshPlayer;
  try {
    freshPlayer = await updatePlayer(username);
    logger.debug(`[Tracker] WOM update OK for ${username}`);
  } catch (err) {
    logger.warn(`[Tracker] WOM update FAILED for ${username}: ${err.message}`);
    return { success: false, displayName: username, error: err.message };
  }

  const freshSnap = extractSnapshot(freshPlayer);
  if (!freshSnap) {
    logger.warn(`[Tracker] No snapshot data returned for ${username}`);
    return { success: false, displayName: username, error: 'No snapshot data from WOM.' };
  }

  // 2. Username change detection
  const currentName = freshPlayer.username;
  const nameChanged = currentName.toLowerCase() !== username.toLowerCase();
  if (nameChanged) {
    logger.info(`[Tracker] Username change: ${username} → ${currentName}`);
    queries.updatePlayerUsername.run(currentName, wom_id);
  }

  // 3. Load stored baseline
  const storedRow          = queries.getSnapshot.get(wom_id);
  const storedSnap         = storedRow ? JSON.parse(storedRow.snapshot_json) : null;
  const storedAchievements = storedRow
    ? (JSON.parse(storedRow.snapshot_json).achievements ?? [])
    : [];

  // 4. Fetch achievements
  let freshAchievements = [];
  try {
    freshAchievements = await getPlayerAchievements(currentName);
    logger.debug(`[Tracker] Fetched ${freshAchievements.length} achievements for ${currentName}`);
  } catch (err) {
    logger.warn(`[Tracker] Could not fetch achievements for ${currentName}: ${err.message}`);
  }

  // 5. Compute diffs
  let levelChanges    = [];
  let bossChanges     = [];
  let clueChanges     = [];
  let newAchievements = [];
  let level99s        = []; // skills that just hit 99
  let totalLevelMilestone = null; // e.g. 2000
  let bossKCMilestones    = []; // [{ boss, kc }]
  let firstRun        = false;

  if (storedSnap) {
    levelChanges    = diffSkills(storedSnap, freshSnap);
    bossChanges     = diffBosses(storedSnap, freshSnap);
    clueChanges     = diffClues(storedSnap, freshSnap);
    newAchievements = diffAchievements(storedAchievements, freshAchievements);

    // --- Level 99 milestone detection ---
    for (const c of levelChanges) {
      if (c.newLevel === 99) level99s.push(c.skill);
    }

    // --- Total level milestone detection ---
    const oldTotal = storedSnap.skills?.overall?.level ?? 0;
    const newTotal = freshSnap.skills?.overall?.level  ?? 0;
    for (const milestone of TOTAL_LEVEL_MILESTONES) {
      if (oldTotal < milestone && newTotal >= milestone) {
        totalLevelMilestone = milestone;
        break;
      }
    }

    // --- Boss KC milestone detection ---
    for (const c of bossChanges) {
      for (const milestone of BOSS_KC_MILESTONES) {
        if (c.oldKills < milestone && c.newKills >= milestone) {
          bossKCMilestones.push({ boss: c.boss, kc: milestone });
        }
      }
    }

    logger.info(
      `[Tracker] Diff for ${currentName}: ` +
      `levels=${levelChanges.length} (99s: ${level99s.length}), ` +
      `bosses=${bossChanges.length} (milestones: ${bossKCMilestones.length}), ` +
      `achievements=${newAchievements.length}, clues=${clueChanges.length}` +
      (totalLevelMilestone ? `, totalLevel=${totalLevelMilestone}` : ''),
    );
  } else {
    firstRun = true;
    logger.info(`[Tracker] First snapshot stored for ${currentName} – notifications start next cycle`);
  }

  // 6. Persist new snapshot (before notifying – prevents double-notify on Discord errors)
  queries.upsertSnapshot.run({
    wom_id,
    username:      currentName,
    snapshot_json: JSON.stringify({ ...freshSnap, achievements: freshAchievements }),
    updated_at:    Date.now(),
  });
  logger.debug(`[Tracker] Snapshot saved for ${currentName}`);

  // 7. Notify each guild – skip entirely if nothing changed and no name change
  const totalChanges = levelChanges.length + bossChanges.length + newAchievements.length + clueChanges.length;
  if (!firstRun && totalChanges === 0 && !nameChanged) {
    logger.info(`[Tracker] No changes for ${currentName} – skipping notifications`);
    return {
      success: true, displayName: currentName, firstRun: false, nameChanged: false,
      changes: { levels: 0, bosses: 0, achievements: 0, clues: 0 },
    };
  }

  const guildRows = queries.getGuildsForPlayer.all(wom_id);
  logger.debug(`[Tracker] Sending notifications to ${guildRows.length} guild(s) for ${currentName}`);

  for (const { guild_id } of guildRows) {
    const opts = getEffectiveOptions(guild_id);

    // ── Cooldown check ───────────────────────────────────────────────────────
    // Skip non-milestone notifications if the player was notified too recently.
    const cooldownMs   = (opts.cooldown_hours ?? 0) * 60 * 60 * 1000;
    const lastNotified = cooldownMs > 0 ? queries.getPlayerCooldown.get(guild_id, wom_id) : 0;
    const onCooldown   = cooldownMs > 0 && (Date.now() - lastNotified) < cooldownMs;

    // ── Per-guild filtered changes ────────────────────────────────────────────
    const minLevel  = opts.min_level_notify   ?? 30;
    const minBossKC = opts.min_boss_kc_notify ?? 5;

    // Always post level 99s and milestones regardless of thresholds/cooldown.
    // Filter regular level changes by min_level_notify.
    const filteredLevels = levelChanges.filter(c => c.newLevel >= minLevel);
    const filteredBosses = bossChanges.filter(c => c.newKills >= minBossKC);

    if (nameChanged) {
      await notifyNameChange(client, guild_id, username, currentName);
    }

    if (!onCooldown) {
      if (opts.track_levels && filteredLevels.length) {
        await notifyLevels(client, guild_id, currentName, filteredLevels);
      }
      if (opts.track_bosses && filteredBosses.length) {
        await notifyBosses(client, guild_id, currentName, filteredBosses);
      }
      if (opts.track_achievements && newAchievements.length) await notifyAchievements(client, guild_id, currentName, newAchievements);
      if (opts.track_clues        && clueChanges.length)     await notifyClues(client, guild_id, currentName, clueChanges);
    } else {
      logger.debug(`[Tracker] ${currentName} on cooldown for guild ${guild_id} — skipping regular notifications`);
    }

    // Milestones always fire, even on cooldown.
    if (opts.track_levels) {
      for (const skill of level99s) {
        await notifyLevel99(client, guild_id, currentName, skill);
      }
    }
    if (totalLevelMilestone) {
      await notifyTotalLevelMilestone(client, guild_id, currentName, totalLevelMilestone);
    }
    if (opts.track_bosses) {
      for (const { boss, kc } of bossKCMilestones) {
        await notifyBossKCMilestone(client, guild_id, currentName, boss, kc);
      }
    }

    // Update cooldown timestamp if we sent any regular notifications.
    const sentSomething = !onCooldown && (
      filteredLevels.length || filteredBosses.length || newAchievements.length || clueChanges.length
    );
    if (cooldownMs > 0 && sentSomething) {
      queries.setPlayerCooldown.run(guild_id, wom_id, Date.now());
    }
  }

  return {
    success:     true,
    displayName: currentName,
    firstRun,
    nameChanged,
    oldName:     nameChanged ? username : undefined,
    changes: {
      levels:       levelChanges.length,
      bosses:       bossChanges.length,
      achievements: newAchievements.length,
      clues:        clueChanges.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Weekly leaderboard auto-post
// ---------------------------------------------------------------------------

/**
 * If today is Monday and the guild hasn't received a weekly post yet this week,
 * fetch gains and post the leaderboard to the announcement channel.
 */
async function maybePostWeekly(guildId) {
  const now = new Date();
  if (now.getDay() !== 1) return; // 1 = Monday

  const row = queries.getWeeklyPost.get(guildId);
  if (row) {
    const daysSince = (now - new Date(row.last_posted_at)) / (1000 * 60 * 60 * 24);
    if (daysSince < 6) return; // already posted this week
  }

  const guildRow = queries.getGuild.get(guildId);
  if (!guildRow?.channel_id) return;

  const players = queries.getPlayersByGuild.all(guildId);
  if (!players.length) return;

  logger.info(`[Tracker] Auto weekly post for guild ${guildId}`);

  try {
    // Lazy-import to avoid circular dependency (weeklytop imports wom which is fine).
    const { fetchWeeklyXp, postWeeklyLeaderboard } = await import('../commands/weeklytop.js');
    const results = await fetchWeeklyXp(players);
    if (!results.length) return;

    const channel = await _client.channels.fetch(guildRow.channel_id);
    await postWeeklyLeaderboard(channel, results);
    queries.setWeeklyPost.run(guildId, now.toISOString());
  } catch (err) {
    logger.error(`[Tracker] Auto weekly post failed for guild ${guildId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Group member sync
// ---------------------------------------------------------------------------

async function maybeSyncGroup(guildId) {
  const group = queries.getWomGroup.get(guildId);
  if (!group) return;

  // Only sync once per hour
  if (group.synced_at && Date.now() - group.synced_at < 60 * 60 * 1000) return;

  logger.info(`[Tracker] Syncing WOM group "${group.name}" for guild ${guildId}`);
  try {
    const members = await getGroupMembers(group.id);
    let added = 0;
    for (const member of members) {
      const player = member.player;
      if (!player?.id || !player?.username) continue;
      const existing = queries.getPlayerByUsernameAndGuild.get(player.username, guildId);
      if (existing) continue;
      queries.upsertPlayer.run({ wom_id: player.id, username: player.username, guild_id: guildId });
      if (!queries.getSnapshot.get(player.id) && player.latestSnapshot?.data) {
        const snap = player.latestSnapshot.data;
        queries.upsertSnapshot.run({
          wom_id: player.id, username: player.username,
          snapshot_json: JSON.stringify({ username: player.username, skills: snap.skills ?? {}, bosses: snap.bosses ?? {}, activities: snap.activities ?? {}, achievements: [] }),
          updated_at: Date.now(),
        });
      }
      added++;
    }
    queries.setWomGroup.run(guildId, { ...group, synced_at: Date.now() });
    if (added > 0) logger.info(`[Tracker] Group sync: added ${added} new member(s) to guild ${guildId}`);
  } catch (err) {
    logger.warn(`[Tracker] Group sync failed for guild ${guildId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Cycle runner
// ---------------------------------------------------------------------------

async function runCycle() {
  if (_cycleRunning) {
    logger.warn('[Tracker] Cycle already in progress – skipping this tick.');
    return;
  }

  _cycleRunning = true;
  const startedAt = new Date();
  logger.info(`[Tracker] ======= Cycle START at ${startedAt.toISOString()} =======`);

  try {
    const allPlayers    = queries.getAllPlayers.all();
    const seen          = new Set();
    const uniquePlayers = allPlayers.filter(p => {
      if (seen.has(p.wom_id)) return false;
      seen.add(p.wom_id);
      return true;
    });

    logger.info(`[Tracker] ${uniquePlayers.length} unique player(s) to process`);

    for (const playerRow of uniquePlayers) {
      await processPlayer(_client, playerRow);
    }

    // Auto weekly leaderboard (runs on Mondays, once per week per guild).
    const guilds = queries.getAllGuilds.all();
    for (const { guild_id } of guilds) {
      await maybePostWeekly(guild_id);
    }

    for (const { guild_id } of guilds) {
      await maybeSyncGroup(guild_id);
    }
  } finally {
    _cycleRunning = false;
    _lastCycleAt  = new Date();
    logger.info(`[Tracker] ======= Cycle DONE at ${_lastCycleAt.toISOString()} =======`);
  }
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Start the automatic polling interval.  Must be called once after Discord login.
 */
export function startTracker(client) {
  _client = client;
  logger.info(`[Tracker] Started. Interval: ${INTERVAL_MS / 1000}s`);

  // Schedule next cycle and update _nextCycleAt on each tick.
  const schedule = () => {
    _nextCycleAt = new Date(Date.now() + INTERVAL_MS);
    logger.info(`[Tracker] Next automatic cycle at ${_nextCycleAt.toISOString()}`);
    setTimeout(async () => {
      await runCycle().catch(err => logger.error('[Tracker] Cycle error:', err));
      schedule(); // reschedule after each run
    }, INTERVAL_MS);
  };

  // Run immediately on startup, then start the schedule.
  _nextCycleAt = new Date(Date.now() + INTERVAL_MS);
  runCycle()
    .catch(err => logger.error('[Tracker] Initial cycle error:', err))
    .finally(() => schedule());
}

/**
 * Manually trigger a full cycle (all tracked players).
 * Used by /checkupdate with no username argument.
 */
export async function triggerFullCycle() {
  if (!_client) throw new Error('Tracker not started yet.');
  logger.info('[Tracker] Manual full cycle triggered');
  await runCycle();
  return queries.getAllPlayers.all().length;
}

/**
 * Manually trigger a refresh for one specific player in a guild.
 * Used by /checkupdate <username>.
 *
 * @param {string} username
 * @param {string} guildId
 * @returns {Promise<ProcessResult>}
 */
export async function triggerPlayer(username, guildId) {
  if (!_client) throw new Error('Tracker not started yet.');

  const playerRow = queries.getPlayerByUsernameAndGuild.get(username, guildId);
  if (!playerRow) {
    return { success: false, displayName: username, error: `Player **${username}** is not tracked in this server.` };
  }

  logger.info(`[Tracker] Manual trigger for player ${username} in guild ${guildId}`);
  return processPlayer(_client, playerRow);
}
