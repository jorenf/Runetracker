/**
 * src/http/server.js
 * Lightweight Express server for receiving RuneLite plugin loot webhooks.
 *
 * Endpoints:
 *   GET  /health              – Railway healthcheck
 *   POST /webhook/loot        – RuneLite plugin drop submission
 */

import express from 'express';
import { queries } from '../db/index.js';
import { getItemPrice } from '../services/prices.js';
import { buildBigDropEmbed } from '../utils/embeds.js';
import logger from '../utils/logger.js';

export function createServer(client) {
  const app = express();
  app.use(express.json());

  // ── Health ────────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── Loot webhook ──────────────────────────────────────────────────────────

  app.post('/webhook/loot', async (req, res) => {
    // Authenticate via Bearer token
    const auth = req.headers['authorization'] ?? '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token.' });
    }
    const token = auth.slice(7).trim();

    const guild = queries.getGuildByLootToken.get(token);
    if (!guild) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Validate payload
    const { player, item_name, item_id, quantity = 1, source = 'Unknown', kc, timestamp } = req.body ?? {};
    if (!player || !item_name) {
      return res.status(400).json({ error: 'Required fields: player, item_name.' });
    }

    // Look up GE value
    let value = 0;
    try {
      const unitPrice = await getItemPrice(item_id ?? null);
      value = unitPrice * Math.max(1, quantity);
    } catch {
      // value stays 0 — non-fatal
    }

    const entry = {
      player,
      item_name,
      item_id:  item_id  ?? null,
      qty:      Math.max(1, quantity),
      value,
      source,
      kc:       kc ?? null,
      ts:       timestamp ?? Date.now(),
    };

    queries.addLootEntry.run(guild.guild_id, entry);
    logger.info(`[Loot] ${player} | ${item_name} x${entry.qty} = ${value.toLocaleString()} gp | guild ${guild.guild_id}`);

    // Big drop notification
    const threshold = guild.loot_threshold_gp ?? 10_000_000;
    const notifyChannelId = guild.loot_channel_id ?? guild.channel_id;
    if (value >= threshold && notifyChannelId) {
      try {
        const channel = await client.channels.fetch(notifyChannelId);
        await channel.send({ embeds: [buildBigDropEmbed(player, entry)] });
      } catch (err) {
        logger.warn(`[Loot] Could not send big drop notification: ${err.message}`);
      }
    }

    return res.json({ ok: true, value });
  });

  // ── Start ─────────────────────────────────────────────────────────────────

  const port = parseInt(process.env.PORT ?? '3000', 10);
  app.listen(port, () => logger.info(`[HTTP] Listening on port ${port}`));

  return app;
}
