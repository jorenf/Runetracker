/**
 * deploy-commands.js
 * Run this script once (or after changing commands) to register slash commands
 * with the Discord API:
 *
 *   node deploy-commands.js
 *
 * Commands are registered globally (available in all servers). Global
 * registration can take up to an hour to propagate. For faster testing during
 * development, pass a GUILD_ID environment variable to register only to a
 * specific server (instant update):
 *
 *   GUILD_ID=123456789 node deploy-commands.js
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

// Collect all command data payloads.
const commands = [];
const commandsPath = join(__dirname, 'src', 'commands');
for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const { default: command } = await import(join(commandsPath, file));
  if (command?.data) {
    commands.push(command.data.toJSON());
    console.log(`  + ${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  console.log(`Registering ${commands.length} slash command(s)…`);

  const route = GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);

  const data = await rest.put(route, { body: commands });
  console.log(`Successfully registered ${data.length} command(s).`);
  if (!GUILD_ID) {
    console.log('Note: Global commands can take up to 1 hour to appear in all servers.');
  }
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
