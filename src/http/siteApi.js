import { Router } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { queries, getEffectiveOptions } from '../db/index.js';
import { getTrackerState } from '../services/tracker.js';
import { fetchWeeklyXp } from '../services/weekly.js';
import {
  buildCommandCatalog,
  buildLeaderboards,
  buildSiteSummary,
  sanitizeGuild,
} from './siteData.js';

const WEEKLY_CACHE_MS = Number(process.env.SITE_WEEKLY_CACHE_MS ?? 15 * 60 * 1000);
let weeklyCache = { expiresAt: 0, data: null };

function readSnapshot(womId) {
  const row = queries.getSnapshot.get(womId);
  if (!row) return null;
  try {
    return {
      snapshot: JSON.parse(row.snapshot_json),
      updated_at: row.updated_at ?? null,
    };
  } catch {
    return { snapshot: null, updated_at: row.updated_at ?? null };
  }
}

async function discordGuild(client, guildId) {
  const cached = client.guilds?.cache?.get?.(guildId);
  if (cached) return cached;
  try {
    return await client.guilds.fetch(guildId);
  } catch {
    return null;
  }
}

async function collectGuilds(client) {
  const rows = queries.getAllGuilds.all();
  return Promise.all(rows.map(async row => {
    const players = queries.getPlayersByGuild.all(row.guild_id);
    const lootSettings = queries.getLootSettings.get(row.guild_id);
    const group = queries.getWomGroup.get(row.guild_id);
    const opts = getEffectiveOptions(row.guild_id);
    const discord = await discordGuild(client, row.guild_id);
    const trackingEnabled = ['track_levels', 'track_bosses', 'track_achievements', 'track_clues']
      .filter(key => Boolean(opts[key])).length;

    return sanitizeGuild({
      name: discord?.name ?? `Server ${row.guild_id.slice(-4)}`,
      member_count: discord?.memberCount ?? null,
      player_count: players.length,
      wom_group: group?.name ?? null,
      loot_entries: lootSettings?.entry_count ?? 0,
      tracking_enabled: trackingEnabled,
      has_loot_channel: Boolean(lootSettings?.loot_channel_id),
    });
  }));
}

function collectPlayers() {
  const byId = new Map();
  for (const player of queries.getAllPlayers.all()) {
    if (byId.has(player.wom_id)) continue;
    const snap = readSnapshot(player.wom_id);
    byId.set(player.wom_id, {
      wom_id: player.wom_id,
      username: player.username,
      snapshot: snap?.snapshot ?? null,
      updated_at: snap?.updated_at ?? null,
    });
  }
  return [...byId.values()];
}

function collectLootEntries() {
  return queries.getAllGuilds.all().flatMap(row => queries.getLootEntries.all(row.guild_id));
}

async function collectSiteData(client) {
  const [guilds, players] = await Promise.all([
    collectGuilds(client),
    Promise.resolve(collectPlayers()),
  ]);
  const lootEntries = collectLootEntries();
  const commands = buildCommandCatalog(client.commands?.values?.() ?? []);
  const trackerState = getTrackerState();

  return {
    generated_at: new Date().toISOString(),
    summary: buildSiteSummary({ guilds, players, lootEntries, trackerState }),
    guilds,
    leaderboards: buildLeaderboards(players, lootEntries),
    commands,
  };
}

function requireSiteKey(req, res) {
  const expected = process.env.SITE_API_KEY;
  if (!expected) return true;

  const provided = req.get('x-site-key') ?? req.query.key ?? '';
  if (provided === expected) return true;

  res.status(401).json({ error: 'Invalid site API key.' });
  return false;
}

function allowedCorsOrigin(origin) {
  const configured = process.env.SITE_CORS_ORIGIN ?? '*';
  if (configured === '*') return '*';

  const allowed = configured.split(',').map(value => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] ?? '*';
}

function withCors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', allowedCorsOrigin(req.get('origin')));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Site-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
}

export function createSiteApiRouter(client) {
  const router = Router();
  router.use(withCors);
  router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  router.get('/api/site', async (req, res) => {
    if (!requireSiteKey(req, res)) return;
    res.json(await collectSiteData(client));
  });

  router.get('/api/site/commands', (req, res) => {
    if (!requireSiteKey(req, res)) return;
    res.json({
      generated_at: new Date().toISOString(),
      commands: buildCommandCatalog(client.commands?.values?.() ?? []),
    });
  });

  router.get('/api/site/weekly-xp', async (req, res) => {
    if (!requireSiteKey(req, res)) return;

    const now = Date.now();
    if (weeklyCache.data && weeklyCache.expiresAt > now) {
      res.json({ ...weeklyCache.data, cached: true });
      return;
    }

    const players = collectPlayers().map(player => ({ username: player.username }));
    const rows = await fetchWeeklyXp(players);
    const data = {
      generated_at: new Date().toISOString(),
      cached: false,
      cache_ms: WEEKLY_CACHE_MS,
      rows: rows.slice(0, 25).map((row, index) => ({ rank: index + 1, ...row })),
    };
    weeklyCache = { expiresAt: now + WEEKLY_CACHE_MS, data };
    res.json(data);
  });

  return router;
}

export function resolveSiteDir() {
  const dir = process.env.SITE_DIR;
  if (!dir) return null;
  const absolute = resolve(dir);
  return existsSync(absolute) ? absolute : null;
}
