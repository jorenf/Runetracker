import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHiscoreResponse } from '../src/services/hiscores.js';

test('parses official OSRS skill, clue, and boss rows into tracker snapshots', () => {
  const rows = Array.from({ length: 117 }, (_, index) => (
    index < 25 ? `${index},${index},${index * 100}` : `${index},${index}`
  ));
  const player = parseHiscoreResponse(rows.join('\n'), 'Test Player');
  const snapshot = player.latestSnapshot.data;

  assert.equal(player.username, 'Test Player');
  assert.deepEqual(snapshot.skills.attack, { rank: 1, level: 1, experience: 100 });
  assert.deepEqual(snapshot.skills.sailing, { rank: 24, level: 24, experience: 2400 });
  assert.deepEqual(snapshot.activities.grid_points, { rank: 25, score: 25 });
  assert.deepEqual(snapshot.activities.deadman_points, { rank: 27, score: 27 });
  assert.deepEqual(snapshot.activities.bounty_hunter_legacy_rogue, { rank: 31, score: 31 });
  assert.deepEqual(snapshot.activities.clue_scrolls_all, { rank: 32, score: 32 });
  assert.deepEqual(snapshot.bosses.abyssal_sire, { rank: 45, kills: 45 });
  assert.deepEqual(snapshot.bosses.tztok_jad, { rank: 108, kills: 108 });
  assert.deepEqual(snapshot.bosses.zulrah, { rank: 116, kills: 116 });
});

test('keeps Jad killcount aligned after OSRS activity rows', () => {
  const rows = Array.from({ length: 117 }, (_, index) => (
    index < 25 ? '-1,-1,-1' : '-1,0'
  ));
  rows[104] = '202957,301';
  rows[108] = '-1,4';

  const snapshot = parseHiscoreResponse(rows.join('\n'), 'renatreese').latestSnapshot.data;

  assert.equal(snapshot.bosses.thermonuclear_smoke_devil.kills, 301);
  assert.equal(snapshot.bosses.tztok_jad.kills, 4);
});

test('normalizes unranked hiscore rows and rejects incomplete responses', () => {
  const rows = Array.from({ length: 117 }, (_, index) => index < 25 ? '-1,-1,-1' : '-1,-1');
  const player = parseHiscoreResponse(rows.join('\n'), 'Unranked');

  assert.deepEqual(player.latestSnapshot.data.skills.overall, { rank: -1, level: 0, experience: 0 });
  assert.deepEqual(player.latestSnapshot.data.bosses.abyssal_sire, { rank: -1, kills: 0 });
  assert.throws(() => parseHiscoreResponse('1,1,1', 'Missing'), /incomplete data/);
});
