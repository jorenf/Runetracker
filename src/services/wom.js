/**
 * src/services/wom.js
 * Thin wrapper around the WiseOldMan v2 REST API.
 *
 * All public functions return plain objects from the API response or throw a
 * descriptive Error on failure.  Callers are responsible for catching errors.
 *
 * Rate limiting: every WOM call shares a bounded queue below the public API
 * limit and honors Retry-After when WOM responds with HTTP 429.
 */

import logger from '../utils/logger.js';
import { womLimiter } from '../utils/ratelimiter.js';

const BASE_URL = 'https://api.wiseoldman.net/v2';

/** Optional API key – include if you have one to get higher rate limits. */
const API_KEY = process.env.WOM_API_KEY?.trim();

logger.info(`[WOM] API key ${API_KEY ? 'configured' : 'not configured'} via WOM_API_KEY.`);

/**
 * Internal: fire an HTTP request and return parsed JSON.
 * All calls are routed through the shared rate-limiter queue.
 * Throws on non-2xx responses with a helpful message.
 *
 * @param {string} path    – URL path starting with /
 * @param {object} [opts]  – fetch options (method, body, etc.)
 */
function retryAfterMs(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) return 60_000;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? 60_000 : Math.max(0, retryAt - Date.now());
}

async function request(path, opts = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await womLimiter.enqueue(async () => {
        const url = `${BASE_URL}${path}`;
        const headers = { 'Content-Type': 'application/json', ...opts.headers };
        if (API_KEY) headers['x-api-key'] = API_KEY;

        logger.debug(`WOM ${opts.method ?? 'GET'} ${url}`);

        let response;
        try {
          response = await fetch(url, { ...opts, headers });
        } catch (networkErr) {
          throw new Error(`Network error reaching WOM API: ${networkErr.message}`);
        }

        let responseText;
        try {
          responseText = await response.text();
        } catch (bodyErr) {
          throw new Error(`Could not read WOM API response (HTTP ${response.status}): ${bodyErr.message}`);
        }

        let body = null;
        try {
          body = responseText ? JSON.parse(responseText) : null;
        } catch {
          if (response.ok) throw new Error(`WOM API returned non-JSON response (HTTP ${response.status})`);
        }

        if (response.status === 429) {
          const delay = retryAfterMs(response);
          womLimiter.pauseFor(delay);
          const error = new Error(`WOM API rate limit reached; retrying after ${Math.ceil(delay / 1000)}s.`);
          error.status = 429;
          throw error;
        }

        if (!response.ok) {
          const msg = body?.message ?? body?.error ?? `HTTP ${response.status}`;
          throw new Error(`WOM API error: ${msg}`);
        }

        return body;
      });
    } catch (err) {
      if (err.status !== 429 || attempt === 1) throw err;
      logger.warn(`[WOM] Rate-limited request will be retried once after the server's delay.`);
    }
  }
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
 * Fetch a player's profile by its stable WOM ID.
 * Returns the WOM Player object (includes latestSnapshot).
 *
 * @param {number|string} playerId
 * @returns {Promise<object>}
 */
export async function getPlayerById(playerId) {
  return request(`/players/id/${encodeURIComponent(playerId)}`);
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

export async function getPlayerGainsSince(username, startDate) {
  const start = encodeURIComponent(startDate.toISOString());
  const end   = encodeURIComponent(new Date().toISOString());
  return request(`/players/${encodeURIComponent(username)}/gained?startDate=${start}&endDate=${end}`);
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

export async function searchGroups(name) {
  return request(`/groups?name=${encodeURIComponent(name)}&limit=5`);
}

export async function getGroup(groupId) {
  return request(`/groups/${groupId}`);
}

export async function getGroupMembers(groupId) {
  return request(`/groups/${groupId}/members?limit=500`);
}
