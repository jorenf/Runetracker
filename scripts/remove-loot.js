import 'dotenv/config';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.');
}

const removedCommandNames = new Set([
  'loot',
  'loottoken',
  'setlootchannel',
  'testdrop',
  'topdrop',
]);
const removedGuildFields = [
  'loot_token',
  'loot_channel_id',
  'loot_threshold_gp',
  'loot_entries',
];

function prepareGuildConfigCleanup() {
  const guildsDir = join(process.env.DATA_DIR ?? './data', 'guilds');
  let filenames;
  try {
    filenames = readdirSync(guildsDir).filter(name => name.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  return filenames.flatMap(filename => {
    const path = join(guildsDir, filename);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const removed = removedGuildFields.filter(field => Object.hasOwn(data, field));
    if (!removed.length) return [];

    for (const field of removed) delete data[field];
    return [{ path, data }];
  });
}

async function removeRegisteredCommands(rest, route, scope, failures) {
  try {
    const commands = await rest.get(route);
    for (const command of commands) {
      if (!removedCommandNames.has(command.name)) continue;
      const deleteRoute = scope.guildId
        ? Routes.applicationGuildCommand(DISCORD_CLIENT_ID, scope.guildId, command.id)
        : Routes.applicationCommand(DISCORD_CLIENT_ID, command.id);
      try {
        await rest.delete(deleteRoute);
        console.log(`Removed /${command.name} ${scope.label}`);
      } catch (error) {
        failures.push(`/${command.name} ${scope.label}: ${error.message}`);
      }
    }
  } catch (error) {
    failures.push(`${scope.label}: ${error.message}`);
  }
}

const guildConfigUpdates = prepareGuildConfigCleanup();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ready = new Promise((resolve, reject) => {
  client.once('ready', resolve);
  client.once('error', reject);
});

try {
  await client.login(DISCORD_TOKEN);
  await ready;

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const failures = [];

  await removeRegisteredCommands(
    rest,
    Routes.applicationCommands(DISCORD_CLIENT_ID),
    { label: 'globally' },
    failures,
  );

  for (const guild of client.guilds.cache.values()) {
    await removeRegisteredCommands(
      rest,
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guild.id),
      { guildId: guild.id, label: `from guild ${guild.name} (${guild.id})` },
      failures,
    );
  }

  for (const { path, data } of guildConfigUpdates) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  console.log(`Removed loot fields from ${guildConfigUpdates.length} guild config(s).`);

  if (failures.length) {
    for (const failure of failures) console.error(`Cleanup failed: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Checked ${client.guilds.cache.size} guild(s); loot commands are removed.`);
  }
} finally {
  client.destroy();
}
