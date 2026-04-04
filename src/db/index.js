/**
 * src/db/index.js
 * SQLite database initialisation using better-sqlite3.
 *
 * Tables:
 *   guilds           – Discord server ID → announcement channel ID
 *   players          – WOM player ID + username mapped to a guild
 *   tracking_options – per-guild toggles for what categories to notify about
 *   player_snapshots – last known snapshot data per WOM player (for diffing)
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import logger from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH ?? './data/muskebeers.db';

// Ensure the data directory exists.
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// Open (or create) the database file.
export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent-read performance.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Create all required tables if they do not already exist.
 * Safe to call multiple times (idempotent).
 */
export function initDatabase() {
  db.exec(`
    -- One row per Discord guild.  channel_id is where updates are posted.
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id   TEXT PRIMARY KEY,
      channel_id TEXT
    );

    -- One row per (WOM player, Discord guild) pair.
    -- wom_id is the stable identifier even when a username changes.
    CREATE TABLE IF NOT EXISTS players (
      wom_id    INTEGER NOT NULL,
      username  TEXT    NOT NULL,
      guild_id  TEXT    NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
      PRIMARY KEY (wom_id, guild_id)
    );

    -- Per-guild notification toggles.
    CREATE TABLE IF NOT EXISTS tracking_options (
      guild_id          TEXT    PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
      track_levels      INTEGER NOT NULL DEFAULT 1,
      track_bosses      INTEGER NOT NULL DEFAULT 1,
      track_achievements INTEGER NOT NULL DEFAULT 1,
      track_clues       INTEGER NOT NULL DEFAULT 1
    );

    -- Latest known snapshot JSON per WOM player (shared across all guilds).
    -- Stored as a JSON string for easy deep-diffing.
    CREATE TABLE IF NOT EXISTS player_snapshots (
      wom_id       INTEGER PRIMARY KEY,
      username     TEXT    NOT NULL,
      snapshot_json TEXT   NOT NULL,
      updated_at   INTEGER NOT NULL
    );
  `);

  logger.debug('Database tables verified / created.');
}

// ---------------------------------------------------------------------------
// Prepared statements (compiled once, reused many times for performance).
// ---------------------------------------------------------------------------

export const queries = {
  // Guilds
  upsertGuild: db.prepare(`
    INSERT INTO guilds (guild_id, channel_id)
    VALUES (@guild_id, @channel_id)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
  `),
  getGuild: db.prepare(`SELECT * FROM guilds WHERE guild_id = ?`),
  getAllGuilds: db.prepare(`SELECT * FROM guilds`),

  // Players
  upsertPlayer: db.prepare(`
    INSERT INTO players (wom_id, username, guild_id)
    VALUES (@wom_id, @username, @guild_id)
    ON CONFLICT(wom_id, guild_id) DO UPDATE SET username = excluded.username
  `),
  getPlayerByUsernameAndGuild: db.prepare(`
    SELECT * FROM players WHERE LOWER(username) = LOWER(?) AND guild_id = ?
  `),
  getPlayersByGuild: db.prepare(`
    SELECT * FROM players WHERE guild_id = ?
  `),
  getAllPlayers: db.prepare(`SELECT * FROM players`),
  getGuildsForPlayer: db.prepare(`
    SELECT guild_id FROM players WHERE wom_id = ?
  `),
  updatePlayerUsername: db.prepare(`
    UPDATE players SET username = ? WHERE wom_id = ?
  `),
  deletePlayer: db.prepare(`
    DELETE FROM players WHERE wom_id = ? AND guild_id = ?
  `),

  // Tracking options
  upsertTrackingOptions: db.prepare(`
    INSERT INTO tracking_options (guild_id, track_levels, track_bosses, track_achievements, track_clues)
    VALUES (@guild_id, @track_levels, @track_bosses, @track_achievements, @track_clues)
    ON CONFLICT(guild_id) DO UPDATE SET
      track_levels      = excluded.track_levels,
      track_bosses      = excluded.track_bosses,
      track_achievements = excluded.track_achievements,
      track_clues       = excluded.track_clues
  `),
  getTrackingOptions: db.prepare(`
    SELECT * FROM tracking_options WHERE guild_id = ?
  `),

  // Snapshots
  upsertSnapshot: db.prepare(`
    INSERT INTO player_snapshots (wom_id, username, snapshot_json, updated_at)
    VALUES (@wom_id, @username, @snapshot_json, @updated_at)
    ON CONFLICT(wom_id) DO UPDATE SET
      username      = excluded.username,
      snapshot_json = excluded.snapshot_json,
      updated_at    = excluded.updated_at
  `),
  getSnapshot: db.prepare(`
    SELECT * FROM player_snapshots WHERE wom_id = ?
  `),
};

/**
 * Convenience: get effective tracking options for a guild.
 * Falls back to all-enabled defaults if the guild has no custom options row.
 */
export function getEffectiveOptions(guildId) {
  return (
    queries.getTrackingOptions.get(guildId) ?? {
      guild_id: guildId,
      track_levels: 1,
      track_bosses: 1,
      track_achievements: 1,
      track_clues: 1,
    }
  );
}
