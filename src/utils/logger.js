/**
 * src/utils/logger.js
 * Lightweight structured logger.  Uses console methods so logs appear in
 * stdout/stderr and play nicely with Docker / PM2 log collectors.
 *
 * Levels (ascending severity): debug < info < warn < error
 * Set LOG_LEVEL in .env to control the minimum level that is emitted.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const configuredLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  if (LEVELS[level] < configuredLevel) return;

  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

const logger = {
  debug: (...args) => log('debug', ...args),
  info:  (...args) => log('info',  ...args),
  warn:  (...args) => log('warn',  ...args),
  error: (...args) => log('error', ...args),
};

export default logger;
