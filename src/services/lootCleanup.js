import { Routes } from 'discord.js';

const RETIRED_COMMANDS = new Set([
  'loot',
  'loottoken',
  'setlootchannel',
  'testdrop',
  'topdrop',
]);

export async function removeRetiredLootCommands(client) {
  const applicationId = client.application?.id;
  if (!applicationId) throw new Error('Discord application is not ready.');

  const guilds = [...client.guilds.cache.values()];
  const failures = [];
  let removedCommands = 0;

  async function removeFromScope(route, guildId) {
    const scope = guildId ? `guild ${guildId}` : 'global commands';
    let commands;
    try {
      commands = await client.rest.get(route);
    } catch (error) {
      failures.push(`${scope}: ${error.message}`);
      return;
    }

    for (const command of commands) {
      if (!RETIRED_COMMANDS.has(command.name)) continue;

      const deleteRoute = guildId
        ? Routes.applicationGuildCommand(applicationId, guildId, command.id)
        : Routes.applicationCommand(applicationId, command.id);
      try {
        await client.rest.delete(deleteRoute);
        removedCommands += 1;
      } catch (error) {
        failures.push(`/${command.name} in ${scope}: ${error.message}`);
      }
    }
  }

  await removeFromScope(Routes.applicationCommands(applicationId));
  for (const guild of guilds) {
    await removeFromScope(Routes.applicationGuildCommands(applicationId, guild.id), guild.id);
  }

  if (failures.length) {
    throw new Error(`Could not fully remove retired loot commands: ${failures.join('; ')}`);
  }

  return { removedCommands, guildsChecked: guilds.length };
}
