import test from 'node:test';
import assert from 'node:assert/strict';
import { Routes } from 'discord.js';
import { syncApplicationCommands } from '../src/services/commandSync.js';

test('replaces global commands and removes per-guild copies', async () => {
  const calls = [];
  const commands = [{
    data: { toJSON: () => ({ name: 'status', description: 'Show status' }) },
  }];
  const client = {
    application: { id: 'application-id' },
    commands: new Map(commands.map(command => [command.data.toJSON().name, command])),
    guilds: {
      cache: new Map([
        ['guild-1', { id: 'guild-1' }],
        ['guild-2', { id: 'guild-2' }],
      ]),
    },
    rest: {
      put: async (route, options) => {
        calls.push({ route, body: options.body });
      },
    },
  };

  const result = await syncApplicationCommands(client);

  assert.deepEqual(result, { commandsSynced: 1, guildsCleaned: 2 });
  assert.deepEqual(calls, [
    { route: Routes.applicationCommands('application-id'), body: [{ name: 'status', description: 'Show status' }] },
    { route: Routes.applicationGuildCommands('application-id', 'guild-1'), body: [] },
    { route: Routes.applicationGuildCommands('application-id', 'guild-2'), body: [] },
  ]);
});

test('reports guild cleanup failures after attempting the remaining guilds', async () => {
  const attemptedGuilds = [];
  const client = {
    application: { id: 'application-id' },
    commands: new Map(),
    guilds: {
      cache: new Map([
        ['guild-1', { id: 'guild-1' }],
        ['guild-2', { id: 'guild-2' }],
      ]),
    },
    rest: {
      put: async route => {
        if (route === Routes.applicationGuildCommands('application-id', 'guild-1')) {
          attemptedGuilds.push('guild-1');
          throw new Error('Missing Access');
        }
        if (route === Routes.applicationGuildCommands('application-id', 'guild-2')) {
          attemptedGuilds.push('guild-2');
        }
      },
    },
  };

  await assert.rejects(syncApplicationCommands(client), /guild guild-1 cleanup: Missing Access/);
  assert.deepEqual(attemptedGuilds, ['guild-1', 'guild-2']);
});
