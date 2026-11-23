/**
 * src/http/server.js
 * Lightweight Express server for health, admin, and public site endpoints.
 *
 * Endpoints:
 *   GET  /health              – Railway healthcheck
 */

import express from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { queries } from '../db/index.js';
import logger from '../utils/logger.js';
import { createSiteApiRouter, resolveSiteDir } from './siteApi.js';

const DATA_DIR   = process.env.DATA_DIR ?? './data';
const GUILDS_DIR = join(DATA_DIR, 'guilds');

/** Constant-time string comparison to prevent timing attacks. */
function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminAuth(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) { res.status(503).json({ error: 'ADMIN_SECRET not configured.' }); return false; }
  const key = req.query.key ?? '';
  if (!safeCompare(key, secret)) { res.status(401).json({ error: 'Invalid key.' }); return false; }
  return true;
}

export function createServer(client) {
  const app = express();
  app.use(express.json());
  app.use(createSiteApiRouter(client));

  // ── Health ────────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── Admin endpoints ───────────────────────────────────────────────────────

  /** GET /admin/guilds?key=SECRET — overview of all guilds */
  app.get('/admin/guilds', async (req, res) => {
    if (!adminAuth(req, res)) return;
    try {
      const files = readdirSync(GUILDS_DIR).filter(f => f.endsWith('.json'));
      const guilds = await Promise.all(files.map(async f => {
        const raw  = JSON.parse(readFileSync(join(GUILDS_DIR, f), 'utf8'));
        const guildId = raw.guild_id ?? f.replace('.json', '');

        let discord = null;
        try {
          const g = await client.guilds.fetch(guildId);
          discord = { name: g.name, member_count: g.memberCount, owner_id: g.ownerId };
        } catch { /* bot may have left */ }

        return {
          guild_id:     guildId,
          discord,
          channel_id:   raw.channel_id,
          players:      (raw.players ?? []).map(p => p.username),
          player_count: (raw.players ?? []).length,
          wom_group:    raw.wom_group?.name ?? null,
          tracking:     raw.tracking_options,
          admins:       (raw.guild_admins ?? []).map(a => a.user_id),
        };
      }));
      res.json({ guild_count: guilds.length, guilds });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /admin/guilds/:id?key=SECRET — full detail for one guild */
  app.get('/admin/guilds/:id', (req, res) => {
    if (!adminAuth(req, res)) return;
    try {
      const raw = JSON.parse(readFileSync(join(GUILDS_DIR, `${req.params.id}.json`), 'utf8'));
      const { loot_entries, loot_token, loot_channel_id, loot_threshold_gp, player_cooldowns, ...rest } = raw;
      res.json(rest);
    } catch {
      res.status(404).json({ error: 'Guild not found.' });
    }
  });

  /** GET /admin/stats?key=SECRET — high level numbers */
  app.get('/admin/stats', (req, res) => {
    if (!adminAuth(req, res)) return;
    try {
      const files  = readdirSync(GUILDS_DIR).filter(f => f.endsWith('.json'));
      let totalPlayers = 0;
      const seen = new Set();
      for (const f of files) {
        const raw = JSON.parse(readFileSync(join(GUILDS_DIR, f), 'utf8'));
        for (const p of raw.players ?? []) seen.add(p.wom_id);
      }
      totalPlayers = seen.size;
      res.json({ guilds: files.length, unique_players: totalPlayers });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Start ─────────────────────────────────────────────────────────────────

  const siteDir = resolveSiteDir();
  if (siteDir) {
    app.use(express.static(siteDir, { index: ['RuneTracker.html', 'index.html'] }));
    logger.info(`[HTTP] Serving site from ${siteDir}`);
  }

  const port = parseInt(process.env.PORT ?? '8080', 10);
  app.listen(port, '0.0.0.0', () => logger.info(`[HTTP] Listening on 0.0.0.0:${port}`));

  return app;
}
