import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function createAnnouncementFixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'runetracker-announcement-'));
  process.env.DATA_DIR = dataDir;

  const dbUrl = new URL('../src/db/index.js', import.meta.url);
  dbUrl.searchParams.set('test', randomUUID());
  const db = await import(dbUrl.href);
  db.initDatabase();
  db.queries.upsertGuild.run({ guild_id: 'guild-active', channel_id: 'channel-active' });
  db.queries.upsertGuild.run({ guild_id: 'guild-no-channel', channel_id: null });

  const serviceUrl = new URL('../src/services/releaseAnnouncement.js', import.meta.url);
  serviceUrl.searchParams.set('test', randomUUID());
  const { postReleaseAnnouncement } = await import(serviceUrl.href);
  return { dataDir, postReleaseAnnouncement };
}

test('release announcement retries failures and sends once per active guild', async () => {
  const previousDataDir = process.env.DATA_DIR;
  const { dataDir, postReleaseAnnouncement } = await createAnnouncementFixture();
  let shouldFail = true;
  let sendCount = 0;
  const client = {
    guilds: { cache: new Map([['guild-active', {}]]) },
    channels: {
      fetch: async channelId => {
        assert.equal(channelId, 'channel-active');
        return {
          isTextBased: () => true,
          send: async content => {
            sendCount += 1;
            assert.match(content, /Automatic name-change support/);
            assert.match(content, /https:\/\/runetracker\.icu\/discord/);
            if (shouldFail) throw new Error('Discord unavailable');
            return { id: 'message-1' };
          },
        };
      },
    },
  };

  try {
    assert.deepEqual(await postReleaseAnnouncement(client), { sent: 0, failed: 1 });
    shouldFail = false;
    assert.deepEqual(await postReleaseAnnouncement(client), { sent: 1, failed: 0 });
    assert.deepEqual(await postReleaseAnnouncement(client), { sent: 0, failed: 0 });
    assert.equal(sendCount, 2);
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
