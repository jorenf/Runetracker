import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('database initialization removes legacy loot fields and preserves other guild data', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'runetracker-data-'));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;

  try {
    const moduleUrl = new URL('../src/db/index.js', import.meta.url);
    moduleUrl.searchParams.set('test', randomUUID());
    const { initDatabase } = await import(moduleUrl.href);
    const guildPath = join(dataDir, 'guilds', '123.json');
    writeFileSync(guildPath, JSON.stringify({
      guild_id: '123',
      channel_id: '456',
      players: [{ wom_id: 7, username: 'Alice' }],
      loot_token: 'old-token',
      loot_channel_id: '789',
      loot_threshold_gp: 10,
      loot_entries: [{ item_name: 'Old drop' }],
    }));

    initDatabase();

    const guild = JSON.parse(readFileSync(guildPath, 'utf8'));
    assert.deepEqual(guild, {
      guild_id: '123',
      channel_id: '456',
      players: [{ wom_id: 7, username: 'Alice' }],
    });
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
