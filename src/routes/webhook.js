/**
 * POST /webhook/loot
 *
 * Receives loot payloads from the RuneTracker RuneLite plugin,
 * matches the Bearer token against all guild loot_tokens,
 * and appends the entry to that guild's loot_entries array.
 *
 * Expected body:
 * {
 *   "player":    "Zezima",
 *   "item_name": "Twisted bow",
 *   "item_id":   20997,
 *   "quantity":  1,
 *   "source":    "Chambers of Xeric",
 *   "kc":        142,          // may be null
 *   "timestamp": 1712345678000
 * }
 *
 * Place this file at:  src/routes/webhook.js  (or wherever your routes live)
 * and adjust GUILDS_DIR below to match your data folder.
 */

import { Router } from 'express';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the directory containing {guild_id}.json files.
// Adjust this to match your project layout.
const GUILDS_DIR = join(__dirname, '../../data/guilds');

const router = Router();

/**
 * POST /webhook/loot
 */
router.post('/loot', async (req, res) => {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Empty bearer token' });
  }

  // ── 2. Payload validation ────────────────────────────────────────────────
  const { player, item_name, item_id, quantity, source, timestamp } = req.body ?? {};

  if (
    typeof player !== 'string' || !player ||
    typeof item_name !== 'string' || !item_name ||
    item_id === undefined || item_id === null ||
    !quantity ||
    typeof source !== 'string' || !source ||
    !timestamp
  ) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  // ── 3. Find guild matching this token ────────────────────────────────────
  let matchedPath = null;
  let guildData = null;

  try {
    const files = await readdir(GUILDS_DIR);
    const guildFiles = files.filter(f => f.endsWith('.json'));

    for (const file of guildFiles) {
      const filePath = join(GUILDS_DIR, file);
      try {
        const raw = await readFile(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.loot_token === token) {
          matchedPath = filePath;
          guildData = data;
          break;
        }
      } catch {
        // Skip unreadable / malformed guild files
      }
    }
  } catch (err) {
    console.error('[RuneTracker] Could not read guilds directory:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!matchedPath || !guildData) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // ── 4. Append the loot entry ─────────────────────────────────────────────
  if (!Array.isArray(guildData.loot_entries)) {
    guildData.loot_entries = [];
  }

  const entry = {
    player:      String(player).slice(0, 12),    // RS names are max 12 chars
    item_name:   String(item_name).slice(0, 100),
    item_id:     Number(item_id),
    quantity:    Number(quantity),
    source:      String(source).slice(0, 100),
    kc:          req.body.kc != null ? Number(req.body.kc) : null,
    timestamp:   Number(timestamp),
    received_at: Date.now(),
  };

  guildData.loot_entries.push(entry);

  try {
    await writeFile(matchedPath, JSON.stringify(guildData, null, 2), 'utf8');
  } catch (err) {
    console.error('[RuneTracker] Failed to write guild file:', err);
    return res.status(500).json({ error: 'Failed to save entry' });
  }

  return res.status(200).json({ success: true });
});

export default router;
