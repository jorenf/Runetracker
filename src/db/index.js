/**
 * src/db/index.js
 * JSON-based data store using lowdb (pure JavaScript – no native compilation).
 *
 * The public `queries` object intentionally mirrors the better-sqlite3
 * prepared-statement API (.run(), .get(), .all()) so all other files remain
 * unchanged.
 *
 * Data is persisted to a JSON file on every write.
 *
 * Collections:
 *   guilds           – Discord server ID → announcement channel ID
 *   players          – WOM player ID + username mapped to a guild
 *   tracking_options – per-guild toggles for what categories to notify about
 *   player_snapshots – last known snapshot data per WOM player (for diffing)
 */

import { LowSync }      from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { mkdirSync, existsSync } from 'fs';
import { dirname }      from 'path';
import logger           from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH ?? './data/muskebeers.json';

// Ensure the data directory exists.
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// Default structure written to the file on first run.
const DEFAULT_DATA = {
  guilds:           [],
  players:          [],
  tracking_options: [],
  player_snapshots: [],
  guild_admins:     [], // { guild_id, user_id } – extra bot admins per server
};

const adapter = new JSONFileSync(DB_PATH);
export const db = new LowSync(adapter, DEFAULT_DATA);

// Load persisted data (or write defaults if the file is new).
db.read();

/** Flush in-memory state to disk. Called after every mutation. */
function persist() {
  db.write();
}

/** Shorthand to the live data object. */
const d = () => db.data;

// ---------------------------------------------------------------------------
// initDatabase – no-op for lowdb (file is created automatically), kept for
// API compatibility with the rest of the codebase.
// ---------------------------------------------------------------------------
export function initDatabase() {
  // Migrate existing DB files that pre-date the guild_admins collection.
  if (!db.data.guild_admins) {
    db.data.guild_admins = [];
    db.write();
  }
  logger.debug('Database ready (lowdb / JSON).');
}

// ---------------------------------------------------------------------------
// queries
// Mirrors the better-sqlite3 prepared-statement interface:
//   .run(params)  – insert / update / delete, returns undefined
//   .get(...)     – return the first matching object or null
//   .all(...)     – return an array of matching objects
// ---------------------------------------------------------------------------

export const queries = {

  // ── Guilds ────────────────────────────────────────────────────────────────

  upsertGuild: {
    run({ guild_id, channel_id }) {
      const idx = d().guilds.findIndex(g => g.guild_id === guild_id);
      if (idx >= 0) {
        d().guilds[idx].channel_id = channel_id;
      } else {
        d().guilds.push({ guild_id, channel_id });
      }
      persist();
    },
  },

  getGuild: {
    get: (guild_id) =>
      d().guilds.find(g => g.guild_id === guild_id) ?? null,
  },

  getAllGuilds: {
    all: () => [...d().guilds],
  },

  // ── Players ───────────────────────────────────────────────────────────────

  upsertPlayer: {
    run({ wom_id, username, guild_id }) {
      const idx = d().players.findIndex(
        p => p.wom_id === wom_id && p.guild_id === guild_id,
      );
      if (idx >= 0) {
        d().players[idx].username = username;
      } else {
        d().players.push({ wom_id, username, guild_id });
      }
      persist();
    },
  },

  getPlayerByUsernameAndGuild: {
    get: (username, guild_id) =>
      d().players.find(
        p =>
          p.username.toLowerCase() === username.toLowerCase() &&
          p.guild_id === guild_id,
      ) ?? null,
  },

  getPlayersByGuild: {
    all: (guild_id) => d().players.filter(p => p.guild_id === guild_id),
  },

  getAllPlayers: {
    all: () => [...d().players],
  },

  getGuildsForPlayer: {
    // Returns objects shaped { guild_id } to match the SQL column projection.
    all: (wom_id) =>
      d()
        .players.filter(p => p.wom_id === wom_id)
        .map(p => ({ guild_id: p.guild_id })),
  },

  updatePlayerUsername: {
    run(username, wom_id) {
      d().players.forEach(p => {
        if (p.wom_id === wom_id) p.username = username;
      });
      persist();
    },
  },

  deletePlayer: {
    run(wom_id, guild_id) {
      db.data.players = d().players.filter(
        p => !(p.wom_id === wom_id && p.guild_id === guild_id),
      );
      persist();
    },
  },

  // ── Tracking options ──────────────────────────────────────────────────────

  upsertTrackingOptions: {
    run({ guild_id, track_levels, track_bosses, track_achievements, track_clues }) {
      const idx = d().tracking_options.findIndex(o => o.guild_id === guild_id);
      const row = { guild_id, track_levels, track_bosses, track_achievements, track_clues };
      if (idx >= 0) {
        d().tracking_options[idx] = row;
      } else {
        d().tracking_options.push(row);
      }
      persist();
    },
  },

  getTrackingOptions: {
    get: (guild_id) =>
      d().tracking_options.find(o => o.guild_id === guild_id) ?? null,
  },

  // ── Player snapshots ──────────────────────────────────────────────────────

  upsertSnapshot: {
    run({ wom_id, username, snapshot_json, updated_at }) {
      const idx = d().player_snapshots.findIndex(s => s.wom_id === wom_id);
      const row = { wom_id, username, snapshot_json, updated_at };
      if (idx >= 0) {
        d().player_snapshots[idx] = row;
      } else {
        d().player_snapshots.push(row);
      }
      persist();
    },
  },

  getSnapshot: {
    get: (wom_id) =>
      d().player_snapshots.find(s => s.wom_id === wom_id) ?? null,
  },

  // ── Guild admins ──────────────────────────────────────────────────────────

  addGuildAdmin: {
    run({ guild_id, user_id }) {
      const exists = d().guild_admins.find(
        a => a.guild_id === guild_id && a.user_id === user_id,
      );
      if (!exists) {
        d().guild_admins.push({ guild_id, user_id });
        persist();
      }
    },
  },

  removeGuildAdmin: {
    run(guild_id, user_id) {
      db.data.guild_admins = d().guild_admins.filter(
        a => !(a.guild_id === guild_id && a.user_id === user_id),
      );
      persist();
    },
  },

  isGuildAdmin: {
    get: (guild_id, user_id) =>
      d().guild_admins.find(
        a => a.guild_id === guild_id && a.user_id === user_id,
      ) ?? null,
  },

  getGuildAdmins: {
    all: (guild_id) => d().guild_admins.filter(a => a.guild_id === guild_id),
  },
};

/**
 * Convenience: get effective tracking options for a guild.
 * Falls back to all-enabled defaults if the guild has no custom options row.
 */
export function getEffectiveOptions(guildId) {
  return (
    queries.getTrackingOptions.get(guildId) ?? {
      guild_id:          guildId,
      track_levels:      1,
      track_bosses:      1,
      track_achievements: 1,
      track_clues:       1,
    }
  );
}
