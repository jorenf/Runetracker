import logger from '../utils/logger.js';

export const WEEKLY_PERIOD = 'week';

function getOverallXpGained(gains) {
  const value = gains?.data?.skills?.overall?.experience?.gained ?? 0;
  return Math.max(0, Number(value) || 0);
}

/**
 * Fetch XP gains for the rolling WOM week period.
 *
 * @param {Array<{username:string}>} players
 * @param {(username:string, period:string) => Promise<object>} [fetchGains]
 * @returns {Promise<Array<{username:string, xp:number}>>}
 */
export async function fetchWeeklyXp(players, fetchGains = null) {
  const results = [];
  const getGains = fetchGains ?? (await import('./wom.js')).getPlayerGains;

  logger.info(`[WeeklyTop] Fetching XP gains for WOM period=${WEEKLY_PERIOD}`);

  for (const player of players) {
    try {
      const gains = await getGains(player.username, WEEKLY_PERIOD);
      const xp = getOverallXpGained(gains);
      if (xp > 0) results.push({ username: player.username, xp });
      logger.debug(`[WeeklyTop] ${player.username}: ${xp} XP gained this week`);
    } catch (err) {
      logger.warn(`[WeeklyTop] Could not fetch gains for ${player.username}: ${err.message}`);
    }
  }

  return results.sort((a, b) => b.xp - a.xp);
}
