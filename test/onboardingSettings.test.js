import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'runetracker-settings-'));
process.env.DATA_DIR = dataDir;

const [{ default: setup, handleWizardInteraction }, { default: settings, handleSettingsInteraction }, db] = await Promise.all([
  import('../src/commands/setup.js?test=wizard'),
  import('../src/commands/settings.js?test=panel'),
  import('../src/db/index.js'),
]);

after(() => rmSync(dataDir, { recursive: true, force: true }));

test('setup wizard reviews choices and saves selected options after channel validation', async () => {
  let payload;
  await setup.execute({
    guildId: 'guild-setup',
    user: { id: 'user-setup', tag: 'Setup tester' },
    reply: async (value) => { payload = value; },
  });
  assert.match(payload.embeds[0].toJSON().title, /Step 1 of 4/);

  const guild = {
    channels: {
      fetch: async (channelId) => ({
        id: channelId,
        permissionsFor: () => ({ has: () => true }),
      }),
    },
    members: { me: {} },
  };
  const makeInteraction = (customId, extra = {}) => ({
    guildId: 'guild-setup',
    user: { id: 'user-setup', tag: 'Setup tester' },
    guild,
    customId,
    update: async (value) => { payload = value; },
    ...extra,
  });

  await handleWizardInteraction(makeInteraction('setup:mode:players'));
  await handleWizardInteraction(makeInteraction('setup:channel', { values: ['channel-setup'] }));
  await handleWizardInteraction(makeInteraction('setup:toggle:bosses'));
  await handleWizardInteraction(makeInteraction('setup:review'));
  assert.match(payload.embeds[0].toJSON().title, /Step 4 of 4/);
  await handleWizardInteraction(makeInteraction('setup:finish'));

  assert.equal(db.queries.getGuild.get('guild-setup').channel_id, 'channel-setup');
  assert.equal(db.getEffectiveOptions('guild-setup').track_bosses, 0);
});

test('setup wizard rejects channels without bot send permissions', async () => {
  let payload;
  await setup.execute({
    guildId: 'guild-no-permission',
    user: { id: 'user-no-permission', tag: 'Setup tester' },
    reply: async () => {},
  });
  const interaction = {
    guildId: 'guild-no-permission',
    user: { id: 'user-no-permission' },
    guild: {
      channels: {
        fetch: async (channelId) => ({
          id: channelId,
          permissionsFor: () => ({ has: () => false }),
        }),
      },
      members: { me: {} },
    },
    customId: 'setup:channel',
    values: ['private-channel'],
    update: async (value) => { payload = value; },
  };
  await handleWizardInteraction({
    ...interaction,
    customId: 'setup:mode:players',
  });
  await handleWizardInteraction(interaction);

  assert.match(payload.content, /View Channel/);
  assert.equal(db.queries.getGuild.get('guild-no-permission'), null);
});

test('settings dashboard exposes controls and saves interactive threshold updates', async () => {
  let payload;
  await settings.execute({
    guildId: 'guild-panel',
    guild: { name: 'Panel test' },
    reply: async (value) => { payload = value; },
  });
  assert.equal(payload.components.length, 3);
  assert.equal(payload.components[1].components.length, 4);

  const admin = {
    guildId: 'guild-panel',
    user: { id: 'admin-panel' },
    memberPermissions: { has: () => true },
    update: async (value) => { payload = value; },
    reply: async (value) => { payload = value; },
  };
  await handleSettingsInteraction({
    ...admin,
    customId: 'settings:toggle:levels',
    isModalSubmit: () => false,
    isMessageComponent: () => true,
  });
  assert.equal(db.getEffectiveOptions('guild-panel').track_levels, 0);

  await handleSettingsInteraction({
    ...admin,
    customId: 'settings:spam:submit',
    isModalSubmit: () => true,
    isFromMessage: () => true,
    fields: {
      getTextInputValue: (field) => ({
        min_level: '40',
        min_boss_kc: '',
        cooldown: '1.5',
      })[field],
    },
  });
  const options = db.getEffectiveOptions('guild-panel');
  assert.equal(options.min_level_notify, 40);
  assert.equal(options.cooldown_hours, 1.5);
});
