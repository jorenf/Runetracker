/**
 * src/services/wom.js
 * Thin wrapper around the WiseOldMan v2 REST API.
 *
 * All public functions return plain objects from the API response or throw a
 * descriptive Error on failure.  Callers are responsible for catching errors.
 *
 * Rate limiting: WOM enforces ~60 req/min per IP.  The tracker service adds
 * a configurable delay between requests so we stay well within that budget.
 */

import logger from '../utils/logger.js';
import { womLimiter } from '../utils/ratelimiter.js';

const BASE_URL = 'https://api.wiseoldman.net/v2';

/** Optional API key – include if you have one to get higher rate limits. */
const API_KEY = process.env.WOM_API_KEY;

/**
 * Internal: fire an HTTP request and return parsed JSON.
 * All calls are routed through the shared rate-limiter queue.
 * Throws on non-2xx responses with a helpful message.
 *
 * @param {string} path    – URL path starting with /
 * @param {object} [opts]  – fetch options (method, body, etc.)
 */
async function request(path, opts = {}) {
  return womLimiter.enqueue(async () => {
    const url = `${BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['x-api-key'] = API_KEY;

    logger.debug(`WOM ${opts.method ?? 'GET'} ${url}`);

    let response;
    try {
      response = await fetch(url, { ...opts, headers });
    } catch (networkErr) {
      throw new Error(`Network error reaching WOM API: ${networkErr.message}`);
    }

    // Parse body regardless of status so we can include error messages.
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`WOM API returned non-JSON response (HTTP ${response.status})`);
    }

    if (!response.ok) {
      const msg = body?.message ?? body?.error ?? `HTTP ${response.status}`;
      throw new Error(`WOM API error: ${msg}`);
    }

    return body;
  });
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/**
 * Fetch a player's profile by username.
 * Returns the WOM Player object (includes latestSnapshot).
 *
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function getPlayer(username) {
  return request(`/players/${encodeURIComponent(username)}`);
}

/**
 * Ask WOM to update a player's stats (crawls the OSRS hiscores).
 * Returns the updated Player object with a fresh latestSnapshot.
 * Throws if the username is not found on the OSRS hiscores.
 *
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function updatePlayer(username) {
  return request(`/players/${encodeURIComponent(username)}`, { method: 'POST' });
}

/**
 * Fetch a player's list of achievements.
 *
 * @param {string} username
 * @returns {Promise<Array>}
 */
export async function getPlayerAchievements(username) {
  return request(`/players/${encodeURIComponent(username)}/achievements`);
}

/**
 * Fetch a player's gains for a given period.
 * period: '5min' | 'day' | 'week' | 'month' | 'year'
 *
 * @param {string} username
 * @param {string} [period='day']
 * @returns {Promise<object>}
 */
export async function getPlayerGains(username, period = 'day') {
  return request(`/players/${encodeURIComponent(username)}/gained?period=${period}`);
}

/**
 * Search for a player by username prefix (useful for fuzzy matching).
 *
 * @param {string} usernamePrefix
 * @returns {Promise<Array>}
 */
export async function searchPlayers(usernamePrefix) {
  return request(`/players/search?username=${encodeURIComponent(usernamePrefix)}`);
}

/**
 * Small helper: resolve a username to a WOM player object, trying an update
 * first so the returned snapshot is as fresh as possible.
 *
 * If the POST update fails (e.g. player is off the hiscores), falls back to
 * GET so we still return whatever WOM has cached.
 *
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function resolvePlayer(username) {
  try {
    return await updatePlayer(username);
  } catch (err) {
    logger.warn(`Could not update player '${username}': ${err.message}. Falling back to GET.`);
    return getPlayer(username);
  }
}
