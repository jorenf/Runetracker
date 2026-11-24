import test from 'node:test';
import assert from 'node:assert/strict';

test('WOM requests use the trimmed WOM_API_KEY as the x-api-key header', async () => {
  const previousApiKey = process.env.WOM_API_KEY;
  const previousRequestsPerMinute = process.env.WOM_REQUESTS_PER_MINUTE;
  const previousFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;

  process.env.WOM_API_KEY = '  railway-test-key  ';
  process.env.WOM_REQUESTS_PER_MINUTE = '59';
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ username: 'Je Vriend' }),
    };
  };

  try {
    const { getPlayer } = await import('../src/services/wom.js?test=api-key');
    const player = await getPlayer('Je Vriend');

    assert.equal(player.username, 'Je Vriend');
    assert.equal(requestUrl, 'https://api.wiseoldman.net/v2/players/Je%20Vriend');
    assert.equal(requestOptions.headers['x-api-key'], 'railway-test-key');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.WOM_API_KEY;
    else process.env.WOM_API_KEY = previousApiKey;
    if (previousRequestsPerMinute === undefined) delete process.env.WOM_REQUESTS_PER_MINUTE;
    else process.env.WOM_REQUESTS_PER_MINUTE = previousRequestsPerMinute;
  }
});

test('WOM can resolve a renamed player by stable player ID', async () => {
  const previousFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => {
    requestUrl = url;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ id: 3182839, username: 'blauwe wafel' }),
    };
  };

  try {
    const { getPlayerById } = await import('../src/services/wom.js?test=player-id');
    const player = await getPlayerById(3182839);

    assert.equal(requestUrl, 'https://api.wiseoldman.net/v2/players/id/3182839');
    assert.equal(player.username, 'blauwe wafel');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('WOM 429 responses are retried once after honoring Retry-After', async () => {
  const previousRequestsPerMinute = process.env.WOM_REQUESTS_PER_MINUTE;
  const previousFetch = globalThis.fetch;
  const { womLimiter } = await import('../src/utils/ratelimiter.js');
  const originalPause = womLimiter.pauseFor;
  const previousPause = originalPause.bind(womLimiter);
  let requestCount = 0;
  const pauses = [];

  process.env.WOM_REQUESTS_PER_MINUTE = '59';
  womLimiter.pauseFor = (milliseconds) => {
    pauses.push(milliseconds);
    previousPause(milliseconds);
  };
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: { get: (name) => name === 'retry-after' ? '0.05' : null },
        text: async () => JSON.stringify({ message: 'Too many requests' }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ username: 'Rate Limited' }),
    };
  };

  try {
    const { getPlayer } = await import('../src/services/wom.js?test=rate-limit-retry');
    const player = await getPlayer('Rate Limited');
    assert.equal(player.username, 'Rate Limited');
    assert.equal(requestCount, 2);
    assert.deepEqual(pauses, [50]);
  } finally {
    globalThis.fetch = previousFetch;
    womLimiter.pauseFor = originalPause;
    if (previousRequestsPerMinute === undefined) delete process.env.WOM_REQUESTS_PER_MINUTE;
    else process.env.WOM_REQUESTS_PER_MINUTE = previousRequestsPerMinute;
  }
});
