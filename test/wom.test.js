import test from 'node:test';
import assert from 'node:assert/strict';

test('WOM requests use the trimmed WOM_API_KEY as the x-api-key header', async () => {
  const previousApiKey = process.env.WOM_API_KEY;
  const previousRequestsPerMinute = process.env.WOM_REQUESTS_PER_MINUTE;
  const previousFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;

  process.env.WOM_API_KEY = '  railway-test-key  ';
  process.env.WOM_REQUESTS_PER_MINUTE = '60000';
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({ username: 'Je Vriend' }),
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
