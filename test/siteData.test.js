import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCommandCatalog, buildLeaderboards, buildSiteSummary } from '../src/http/siteData.js';

function command(raw) {
  return { data: { toJSON: () => raw } };
}

test('buildCommandCatalog flattens slash commands and subcommands one-to-one', () => {
  const catalog = buildCommandCatalog([
    command({
      name: 'setadmin',
      description: 'Manage bot admins for this server.',
      default_member_permissions: '32',
      options: [
        {
          type: 1,
          name: 'add',
          description: 'Grant a user bot-admin access.',
          options: [
            { type: 6, name: 'user', description: 'User to add as admin.', required: true },
          ],
        },
        {
          type: 1,
          name: 'list',
          description: 'List all current bot admins.',
        },
      ],
    }),
    command({
      name: 'track',
      description: 'Start tracking an Old School RuneScape player.',
      default_member_permissions: '32',
      options: [
        { type: 3, name: 'username', description: 'The RuneScape username to track.', required: true },
      ],
    }),
  ]);

  assert.equal(catalog.total, 3);
  assert.deepEqual(catalog.commands.map(c => c.name), ['/setadmin add', '/setadmin list', '/track']);
  assert.equal(catalog.commands[0].admin, true);
  assert.deepEqual(catalog.commands[0].options, [
    { name: 'user', type: 'user', required: true, description: 'User to add as admin.', choices: [] },
  ]);
  assert.equal(catalog.groups.find(g => g.category === 'Setup').commands.length, 2);
  assert.equal(catalog.groups.find(g => g.category === 'Tracking').commands.length, 1);
  assert.equal(catalog.raw[0].name, 'setadmin');
});

test('buildLeaderboards derives total level, boss and loot rankings from live data', () => {
  const players = [
    {
      wom_id: 1,
      username: 'Alice',
      snapshot: {
        skills: { overall: { level: 1800, experience: 120_000_000 } },
        bosses: { zulrah: { kills: 100 }, vorkath: { kills: 25 } },
      },
      updated_at: 1_700_000_000_000,
    },
    {
      wom_id: 2,
      username: 'Bob',
      snapshot: {
        skills: { overall: { level: 2000, experience: 150_000_000 } },
        bosses: { zulrah: { kills: 10 }, nex: { kills: 300 } },
      },
      updated_at: 1_800_000_000_000,
    },
  ];

  const lootEntries = [
    { player: 'Alice', item_name: 'Twisted bow', value: 1_500_000_000, ts: 2 },
    { player: 'Bob', item_name: 'Bandos chestplate', value: 30_000_000, ts: 1 },
    { player: 'Alice', item_name: 'Dexterous prayer scroll', value: 20_000_000, ts: 3 },
  ];

  const boards = buildLeaderboards(players, lootEntries);

  assert.deepEqual(boards.total_level.rows.map(r => r.username), ['Bob', 'Alice']);
  assert.equal(boards.total_level.rows[0].value, 2000);
  assert.deepEqual(boards.boss_kc.rows.map(r => r.username), ['Bob', 'Alice']);
  assert.equal(boards.boss_kc.rows[0].meta, 'Nex');
  assert.equal(boards.loot.rows[0].username, 'Alice');
  assert.equal(boards.loot.rows[0].value, 1_520_000_000);
  assert.deepEqual(boards.recent_loot.rows.map(r => r.item_name), ['Dexterous prayer scroll', 'Twisted bow', 'Bandos chestplate']);
});

test('buildSiteSummary exposes aggregate live counts without private token fields', () => {
  const summary = buildSiteSummary({
    guilds: [
      { name: 'Muskebeers', player_count: 3, loot_entries: 4 },
      { name: 'Raiders', player_count: 2, loot_entries: 1 },
    ],
    players: [
      { wom_id: 1, username: 'Alice', snapshot: { skills: { overall: { experience: 10 } } }, updated_at: 100 },
      { wom_id: 2, username: 'Bob', snapshot: { skills: { overall: { experience: 20 } } }, updated_at: 200 },
    ],
    lootEntries: [
      { value: 50 },
      { value: 70 },
    ],
    trackerState: { cycleRunning: false, intervalMs: 300000 },
  });

  assert.equal(summary.guilds, 2);
  assert.equal(summary.tracked_players, 5);
  assert.equal(summary.unique_players, 2);
  assert.equal(summary.total_xp, 30);
  assert.equal(summary.total_loot_value, 120);
  assert.equal(summary.last_snapshot_at, '1970-01-01T00:00:00.200Z');
  assert.equal(Object.hasOwn(summary, 'loot_token'), false);
});

