import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHiscoreResponse } from '../src/services/hiscores.js';

test('parses official OSRS skill, clue, and boss rows into tracker snapshots', () => {
  const rows = Array.from({ length: 113 }, (_, index) => (
    index < 25 ? `${index},${index},${index * 100}` : `${index},${index}`
  ));
  const player = parseHiscoreResponse(rows.join('\n'), 'Test Player');
  const snapshot = player.latestSnapshot.data;

  assert.equal(player.username, 'Test Player');
  assert.deepEqual(snapshot.skills.attack, { rank: 1, level: 1, experience: 100 });
  assert.deepEqual(snapshot.skills.sailing, { rank: 24, level: 24, experience: 2400 });
  assert.deepEqual(snapshot.activities.clue_scrolls_all, { rank: 28, score: 28 });
  assert.deepEqual(snapshot.bosses.abyssal_sire, { rank: 41, kills: 41 });
  assert.deepEqual(snapshot.bosses.zulrah, { rank: 112, kills: 112 });
});

test('normalizes unranked hiscore rows and rejects incomplete responses', () => {
  const rows = Array.from({ length: 113 }, (_, index) => index < 25 ? '-1,-1,-1' : '-1,-1');
  const player = parseHiscoreResponse(rows.join('\n'), 'Unranked');

  assert.deepEqual(player.latestSnapshot.data.skills.overall, { rank: -1, level: 0, experience: 0 });
  assert.deepEqual(player.latestSnapshot.data.bosses.abyssal_sire, { rank: -1, kills: 0 });
  assert.throws(() => parseHiscoreResponse('1,1,1', 'Missing'), /incomplete data/);
});
