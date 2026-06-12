import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchWeeklyXp, WEEKLY_PERIOD } from '../src/services/weekly.js';

test('fetchWeeklyXp uses the WOM rolling week period for every player', async () => {
  const requested = [];
  const gainsByUser = {
    Alice: 500_000,
    Bob: 12_900,
    Zero: 0,
  };

  const results = await fetchWeeklyXp(
    [{ username: 'Bob' }, { username: 'Alice' }, { username: 'Zero' }],
    async (username, period) => {
      requested.push({ username, period });
      return {
        data: {
          skills: {
            overall: {
              experience: {
                gained: gainsByUser[username],
              },
            },
          },
        },
      };
    },
  );

  assert.deepEqual(requested, [
    { username: 'Bob', period: WEEKLY_PERIOD },
    { username: 'Alice', period: WEEKLY_PERIOD },
    { username: 'Zero', period: WEEKLY_PERIOD },
  ]);
  assert.deepEqual(results, [
    { username: 'Alice', xp: 500_000 },
    { username: 'Bob', xp: 12_900 },
  ]);
});

