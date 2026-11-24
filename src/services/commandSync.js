import { Routes } from 'discord.js';

export async function syncApplicationCommands(client) {
  const applicationId = client.application?.id;
  if (!applicationId) throw new Error('Discord application is not ready.');

  const commands = [...client.commands.values()]
    .map(command => command.data.toJSON());
  const failures = [];

  try {
    await client.rest.put(Routes.applicationCommands(applicationId), { body: commands });
  } catch (error) {
    failures.push(`global commands: ${error.message}`);
  }

  const guilds = [...client.guilds.cache.values()];
  let guildsSynced = 0;
  for (const guild of guilds) {
    try {
      await client.rest.put(
        Routes.applicationGuildCommands(applicationId, guild.id),
        { body: commands },
      );
      guildsSynced += 1;
    } catch (error) {
      failures.push(`guild ${guild.id}: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(`Could not fully synchronize application commands: ${failures.join('; ')}`);
  }

  return { commandsSynced: commands.length, guildsSynced };
}
