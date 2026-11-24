import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasInitializedSnapshotBaseline,
  hasRegularNotifications,
} from '../src/services/tracker.js';

const changes = {
  levels: [],
  bosses: [],
  achievements: [],
  clues: [],
};

test('filtered or disabled changes do not count as a regular notification', () => {
  assert.equal(hasRegularNotifications(
    { track_levels: 1, track_bosses: 0, track_achievements: 1, track_clues: 1 },
    { ...changes, bosses: [{ boss: 'zulrah' }] },
  ), false);
  assert.equal(hasRegularNotifications(
    { track_levels: 1, track_bosses: 1, track_achievements: 0, track_clues: 1 },
    { ...changes, achievements: [{ name: 'achievement' }] },
  ), false);
});

test('an enabled, filtered change counts as a regular notification', () => {
  assert.equal(hasRegularNotifications(
    { track_levels: 1, track_bosses: 0, track_achievements: 0, track_clues: 0 },
    { ...changes, levels: [{ skill: 'attack', newLevel: 50 }] },
  ), true);
});

test('legacy snapshots require one silent hiscores baseline synchronization', () => {
  assert.equal(hasInitializedSnapshotBaseline({ skills: {}, bosses: {} }), false);
  assert.equal(hasInitializedSnapshotBaseline({
    skills: {},
    bosses: {},
    hiscore_baseline_initialized: true,
  }), false);
  assert.equal(hasInitializedSnapshotBaseline({
    skills: {},
    bosses: {},
    hiscore_baseline_initialized: true,
    hiscore_schema_version: 2,
  }), true);
});
