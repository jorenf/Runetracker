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
   * @param {number} requestsPerMinute Max API calls per 60 s.
   * @param {number} maxQueueDepth Rejects excess waiting calls instead of growing without bound.
   */
  constructor(requestsPerMinute = 40, maxQueueDepth = 1000) {
    if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1) {
      throw new RangeError('requestsPerMinute must be a positive integer.');
    }
    if (!Number.isInteger(maxQueueDepth) || maxQueueDepth < 1) {
      throw new RangeError('maxQueueDepth must be a positive integer.');
    }
    this._interval = Math.ceil(60_000 / requestsPerMinute); // ms between calls
    this._lastFired = 0;
    this._pauseUntil = 0;
    this._queue     = [];
    this._running   = false;
    this._maxQueueDepth = maxQueueDepth;
    logger.info(`[RateLimit] WOM queue: ${requestsPerMinute} req/min (${this._interval} ms between calls, max queue ${maxQueueDepth})`);
  }

  /** Enqueue an async function and await its result. */
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      if (this._queue.length >= this._maxQueueDepth) {
        reject(new Error(`WOM request queue is full (${this._maxQueueDepth} pending requests).`));
        return;
      }

      this._queue.push({ fn, resolve, reject });

      if (this._queue.length >= WARN_DEPTH) {
        logger.warn(`[RateLimit] Queue depth ${this._queue.length} – consider raising TRACKER_INTERVAL_MS or lowering tracked players`);
      }

      this._drain();
    });
  }

  /** Number of pending items. */
  get depth() { return this._queue.length; }

  /** Pause new requests after a server-side rate-limit response. */
  pauseFor(milliseconds) {
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      this._pauseUntil = Math.max(this._pauseUntil, Date.now() + milliseconds);
      logger.warn(`[RateLimit] WOM requested a pause of ${Math.ceil(milliseconds / 1000)}s.`);
    }
  }

  // Internal: process the queue at the configured rate.
  async _drain() {
    if (this._running) return;
    this._running = true;

    while (this._queue.length > 0) {
      const wait = Math.max(
        this._lastFired + this._interval,
        this._pauseUntil,
      ) - Date.now();
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
const MAX_WOM_REQUESTS_PER_MINUTE = 59;
const DEFAULT_WOM_REQUESTS_PER_MINUTE = 40;
const configuredWpm = Number(process.env.WOM_REQUESTS_PER_MINUTE ?? DEFAULT_WOM_REQUESTS_PER_MINUTE);
const WPM = Number.isInteger(configuredWpm) && configuredWpm >= 1 && configuredWpm <= MAX_WOM_REQUESTS_PER_MINUTE
  ? configuredWpm
  : DEFAULT_WOM_REQUESTS_PER_MINUTE;

if (WPM !== configuredWpm) {
  logger.warn(`[RateLimit] Invalid WOM_REQUESTS_PER_MINUTE value "${process.env.WOM_REQUESTS_PER_MINUTE}". Using ${DEFAULT_WOM_REQUESTS_PER_MINUTE}; configured maximum is ${MAX_WOM_REQUESTS_PER_MINUTE}.`);
}

export const womLimiter = new RateLimiter(WPM);
