import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileAchievements } from '../src/services/achievements.js';

test('reconcileAchievements seeds an untrusted empty baseline without posting old achievements', () => {
  const result = reconcileAchievements(
    { achievements: [] },
    [{ name: 'Old 99 Cooking' }, { name: 'Old Barrows KC' }],
    true,
  );

  assert.deepEqual(result.newAchievements, []);
  assert.equal(result.achievementsLoaded, true);
  assert.deepEqual(result.achievementsForSnapshot, [
    { name: 'Old 99 Cooking' },
    { name: 'Old Barrows KC' },
  ]);
});

test('reconcileAchievements preserves the previous baseline when WOM achievements cannot be fetched', () => {
  const previous = [{ name: 'Existing Achievement' }];

  const result = reconcileAchievements(
    { achievements: previous, achievements_loaded: true },
    [],
    false,
  );

  assert.deepEqual(result.newAchievements, []);
  assert.equal(result.achievementsLoaded, true);
  assert.deepEqual(result.achievementsForSnapshot, previous);
});

test('reconcileAchievements posts only achievements newer than a trusted baseline', () => {
  const result = reconcileAchievements(
    { achievements: [{ name: 'Existing Achievement' }], achievements_loaded: true },
    [{ name: 'Existing Achievement' }, { name: 'Fresh Achievement' }],
    true,
  );

  assert.deepEqual(result.newAchievements, [{ name: 'Fresh Achievement' }]);
  assert.equal(result.achievementsLoaded, true);
  assert.deepEqual(result.achievementsForSnapshot, [
    { name: 'Existing Achievement' },
    { name: 'Fresh Achievement' },
  ]);
});

