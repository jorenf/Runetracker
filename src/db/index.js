/**
 * src/db/index.js
 * Per-guild file storage.
 *
 * Layout on disk:
 *   data/guilds/{guild_id}.json   – all settings for one Discord server
 *   data/snapshots/{wom_id}.json  – last known WOM snapshot per player
 *                                    (shared; a player tracked in multiple
 *                                     guilds only needs one snapshot)
 *
 * No cross-guild data ever leaks: every guild file is completely self-contained.
 * The queries API keeps the same .run() / .get() / .all() surface so the rest
 * of the codebase requires zero changes.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

const DATA_DIR      = process.env.DATA_DIR ?? './data';
const GUILDS_DIR    = join(DATA_DIR, 'guilds');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');

for (const dir of [GUILDS_DIR, SNAPSHOTS_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

const DEFAULT_GUILD = () => ({
  channel_id:       null,
  players:          [],   // [{ wom_id, username }]
  tracking_options: { track_levels: 1, track_bosses: 1, track_achievements: 1, track_clues: 1 },
  guild_admins:     [],   // [{ user_id }]
  weekly_post:      null, // { last_posted_at }
});

function guildPath(guildId)    { return join(GUILDS_DIR,    `${guildId}.json`); }
function snapshotPath(womId)   { return join(SNAPSHOTS_DIR, `${womId}.json`); }

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

/** Load a guild's data, creating defaults if the file doesn't exist. */
function loadGuild(guildId) {
  return readJSON(guildPath(guildId)) ?? { guild_id: guildId, ...DEFAULT_GUILD() };
}

/** Persist a guild data object. */
function saveGuild(guild) {
  writeJSON(guildPath(guild.guild_id), guild);
}

/** Mutate a guild with a callback, then persist atomically. */
function mutateGuild(guildId, fn) {
  const guild = loadGuild(guildId);
  fn(guild);
  saveGuild(guild);
}

/** Return the guild IDs of all stored guild files. */
function allGuildIds() {
  return readdirSync(GUILDS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5));
}

// ---------------------------------------------------------------------------
// initDatabase – creates directories, no-op if already set up.
// ---------------------------------------------------------------------------

export function initDatabase() {
  for (const dir of [GUILDS_DIR, SNAPSHOTS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  logger.debug(`[DB] Data dir: ${DATA_DIR} | guilds: ${allGuildIds().length}`);
}

// ---------------------------------------------------------------------------
// queries  (same .run() / .get() / .all() API as before)
// ---------------------------------------------------------------------------

export const queries = {

  // ── Guilds ────────────────────────────────────────────────────────────────

  upsertGuild: {
    run({ guild_id, channel_id }) {
      mutateGuild(guild_id, g => { g.channel_id = channel_id; });
      logger.debug(`[DB] upsertGuild ${guild_id} → channel ${channel_id}`);
    },
  },

  getGuild: {
    get(guild_id) {
      const g = readJSON(guildPath(guild_id));
      return g ? { guild_id, channel_id: g.channel_id } : null;
    },
  },

  getAllGuilds: {
    all() {
      return allGuildIds().map(id => {
        const g = readJSON(guildPath(id));
        return { guild_id: id, channel_id: g?.channel_id ?? null };
      });
    },
  },

  // ── Players ───────────────────────────────────────────────────────────────

  upsertPlayer: {
    run({ wom_id, username, guild_id }) {
      mutateGuild(guild_id, g => {
        const idx = g.players.findIndex(p => p.wom_id === wom_id);
        if (idx >= 0) g.players[idx].username = username;
        else          g.players.push({ wom_id, username });
      });
    },
  },

  getPlayerByUsernameAndGuild: {
    get(username, guild_id) {
      const g = loadGuild(guild_id);
      const p = g.players.find(p => p.username.toLowerCase() === username.toLowerCase());
      return p ? { ...p, guild_id } : null;
    },
  },

  getPlayersByGuild: {
    all(guild_id) {
      return loadGuild(guild_id).players.map(p => ({ ...p, guild_id }));
    },
  },

  getAllPlayers: {
    all() {
      const rows = [];
      for (const id of allGuildIds()) {
        const g = readJSON(guildPath(id));
        if (!g) continue;
        for (const p of g.players ?? []) rows.push({ ...p, guild_id: id });
      }
      return rows;
    },
  },

  getGuildsForPlayer: {
    all(wom_id) {
      const result = [];
      for (const id of allGuildIds()) {
        const g = readJSON(guildPath(id));
        if (g?.players?.some(p => p.wom_id === wom_id)) result.push({ guild_id: id });
      }
      return result;
    },
  },

  updatePlayerUsername: {
    run(username, wom_id) {
      for (const id of allGuildIds()) {
        mutateGuild(id, g => {
          g.players.forEach(p => { if (p.wom_id === wom_id) p.username = username; });
        });
      }
    },
  },

  deletePlayer: {
    run(wom_id, guild_id) {
      mutateGuild(guild_id, g => {
        g.players = g.players.filter(p => p.wom_id !== wom_id);
      });
    },
  },

  // ── Tracking options ──────────────────────────────────────────────────────

  upsertTrackingOptions: {
    run({ guild_id, track_levels, track_bosses, track_achievements, track_clues }) {
      mutateGuild(guild_id, g => {
        g.tracking_options = { track_levels, track_bosses, track_achievements, track_clues };
      });
    },
  },

  getTrackingOptions: {
    get(guild_id) {
      const g = readJSON(guildPath(guild_id));
      if (!g) return null;
      return { guild_id, ...g.tracking_options };
    },
  },

  // ── Player snapshots (shared, not per-guild) ──────────────────────────────

  upsertSnapshot: {
    run({ wom_id, username, snapshot_json, updated_at }) {
      writeJSON(snapshotPath(wom_id), { wom_id, username, snapshot_json, updated_at });
    },
  },

  getSnapshot: {
    get(wom_id) {
      return readJSON(snapshotPath(wom_id));
    },
  },

  // ── Guild admins ──────────────────────────────────────────────────────────

  addGuildAdmin: {
    run({ guild_id, user_id }) {
      mutateGuild(guild_id, g => {
        if (!g.guild_admins.find(a => a.user_id === user_id)) {
          g.guild_admins.push({ user_id });
        }
      });
    },
  },

  removeGuildAdmin: {
    run(guild_id, user_id) {
      mutateGuild(guild_id, g => {
        g.guild_admins = g.guild_admins.filter(a => a.user_id !== user_id);
      });
    },
  },

  isGuildAdmin: {
    get(guild_id, user_id) {
      const g = readJSON(guildPath(guild_id));
      return g?.guild_admins?.find(a => a.user_id === user_id) ?? null;
    },
  },

  getGuildAdmins: {
    all(guild_id) {
      return (readJSON(guildPath(guild_id))?.guild_admins ?? []).map(a => ({
        guild_id, user_id: a.user_id,
      }));
    },
  },

  // ── Weekly posts ──────────────────────────────────────────────────────────

  getWeeklyPost: {
    get(guild_id) {
      const g = readJSON(guildPath(guild_id));
      return g?.weekly_post ? { guild_id, ...g.weekly_post } : null;
    },
  },

  setWeeklyPost: {
    run(guild_id, last_posted_at) {
      mutateGuild(guild_id, g => { g.weekly_post = { last_posted_at }; });
    },
  },
};

// ---------------------------------------------------------------------------
// Convenience export
// ---------------------------------------------------------------------------

export function getEffectiveOptions(guildId) {
  return queries.getTrackingOptions.get(guildId) ?? {
    guild_id:           guildId,
    track_levels:       1,
    track_bosses:       1,
    track_achievements: 1,
    track_clues:        1,
  };
}

// Legacy export kept for notifier / tracker compatibility.
export const db = { data: null }; // unused; kept so no import breaks
