/**
 * src/utils/ratelimiter.js
 * Simple FIFO rate-limiter for outbound HTTP requests.
 *
 * All WOM API calls are enqueued here so the bot never exceeds the configured
 * requests-per-minute ceiling, even across many guilds and players.
 *
 * Usage:
 *   const result = await limiter.enqueue(() => fetch(...));
 *
 * Queue depth is logged whenever it grows beyond WARN_DEPTH so you can tune
 * TRACKER_INTERVAL_MS or WOM_REQUESTS_PER_MINUTE if it consistently backs up.
 */

import logger from './logger.js';

const WARN_DEPTH = 20; // log a warning when queue exceeds this length

export class RateLimiter {
  /**
   * @param {number} requestsPerMinute  Max API calls per 60 s (default 40, WOM cap is 60).
   */
  constructor(requestsPerMinute = 40) {
    this._interval = Math.ceil(60_000 / requestsPerMinute); // ms between calls
    this._lastFired = 0;
    this._queue     = [];
    this._running   = false;
    logger.info(`[RateLimit] WOM queue: ${requestsPerMinute} req/min (${this._interval} ms between calls)`);
  }

  /** Enqueue an async function and await its result. */
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });

      if (this._queue.length >= WARN_DEPTH) {
        logger.warn(`[RateLimit] Queue depth ${this._queue.length} – consider raising TRACKER_INTERVAL_MS or lowering tracked players`);
      }

      this._drain();
    });
  }

  /** Number of pending items. */
  get depth() { return this._queue.length; }

  // Internal: process the queue at the configured rate.
  async _drain() {
    if (this._running) return;
    this._running = true;

    while (this._queue.length > 0) {
      const wait = this._lastFired + this._interval - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));

      const { fn, resolve, reject } = this._queue.shift();
      this._lastFired = Date.now();

      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    }

    this._running = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton – one shared limiter for all WOM calls in the process.
// ---------------------------------------------------------------------------
const WPM = parseInt(process.env.WOM_REQUESTS_PER_MINUTE ?? '40', 10);
export const womLimiter = new RateLimiter(WPM);
