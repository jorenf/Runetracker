/**
 * src/services/prices.js
 * OSRS Wiki real-time prices API.
 *
 * /mapping  – item name → ID cache (refreshed every 24 h)
 * /latest   – current GE high/low price per item ID (cached 5 min)
 */

import logger from '../utils/logger.js';

const BASE = 'https://prices.runescape.wiki/api/v1/osrs';
const HEADERS = { 'User-Agent': 'RuneTracker Discord Bot - runetracker.icu' };

const MAPPING_TTL = 24 * 60 * 60 * 1000; // 24 h
const PRICE_TTL   =  5 * 60 * 1000;      // 5 min

let _mapping      = null;   // Map<nameLower, id>
let _mappingAt    = 0;
const _priceCache = new Map(); // id → { price, ts }

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Prices API HTTP ${res.status}`);
  return res.json();
}

async function ensureMapping() {
  if (_mapping && Date.now() - _mappingAt < MAPPING_TTL) return;
  logger.debug('[Prices] Refreshing item mapping…');
  const items = await fetchJSON('/mapping');
  _mapping = new Map(items.map(i => [i.name.toLowerCase(), i.id]));
  _mappingAt = Date.now();
  logger.info(`[Prices] Loaded mapping for ${_mapping.size} items.`);
}

/** Resolve an item name to its OSRS Wiki item ID. Returns null if unknown. */
export async function getItemId(itemName) {
  await ensureMapping();
  return _mapping.get(itemName.toLowerCase()) ?? null;
}

/** Fetch the current GE price for an item ID. Returns 0 if unavailable. */
export async function getItemPrice(itemId) {
  if (!itemId) return 0;
  const cached = _priceCache.get(itemId);
  if (cached && Date.now() - cached.ts < PRICE_TTL) return cached.price;

  try {
    const data = await fetchJSON(`/latest?id=${itemId}`);
    const item  = data.data?.[String(itemId)];
    const price = item?.high ?? item?.low ?? 0;
    _priceCache.set(itemId, { price, ts: Date.now() });
    return price;
  } catch (err) {
    logger.warn(`[Prices] Could not fetch price for item ${itemId}: ${err.message}`);
    return 0;
  }
}

/** Convenience: name → price. Returns 0 if name unknown or price unavailable. */
export async function priceByName(itemName) {
  const id = await getItemId(itemName);
  return id ? getItemPrice(id) : 0;
}
