/**
 * Muskebeers – OSRS Discord Tracking Bot
 * Entry point: creates the Discord client, loads commands/events, and starts
 * the background tracking interval.
 */

import 'dotenv/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './src/db/index.js';
import { startTracker } from './src/services/tracker.js';
import { createServer } from './src/http/server.js';
import logger from './src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Validate required environment variables before anything else.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Discord client setup.
// We only need guild-related intents since all interactions are slash commands.
// ---------------------------------------------------------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Attach a command map to the client so the interaction handler can look them up.
client.commands = new Collection();

// ---------------------------------------------------------------------------
// Load all command files from src/commands/.
// ---------------------------------------------------------------------------
const commandsPath = join(__dirname, 'src', 'commands');
for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const { default: command } = await import(pathToFileURL(join(commandsPath, file)).href);
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
    logger.debug(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command file ${file} is missing 'data' or 'execute' export.`);
  }
}

// ---------------------------------------------------------------------------
// Load all event files from src/events/.
// ---------------------------------------------------------------------------
const eventsPath = join(__dirname, 'src', 'events');
for (const file of readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const { default: event } = await import(pathToFileURL(join(eventsPath, file)).href);
  if (event?.name && event?.execute) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    logger.debug(`Loaded event: ${event.name}`);
  }
}

// ---------------------------------------------------------------------------
// Initialise SQLite database (creates tables if they don't exist).
// ---------------------------------------------------------------------------
initDatabase();
logger.info('Database initialised.');

// ---------------------------------------------------------------------------
// Start HTTP server immediately so Railway's healthcheck passes on boot.
// The Discord client reference is passed in — notifications work once ready.
// ---------------------------------------------------------------------------
createServer(client);

// ---------------------------------------------------------------------------
// Start background tracker after the Discord client is ready.
// ---------------------------------------------------------------------------
client.once('ready', () => {
  startTracker(client);
});

// ---------------------------------------------------------------------------
// Handle graceful shutdown on SIGINT / SIGTERM.
// ---------------------------------------------------------------------------
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  client.destroy();
  process.exit(0);
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Handle unexpected errors so the process doesn't silently die.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Log in to Discord.
// ---------------------------------------------------------------------------
await client.login(process.env.DISCORD_TOKEN);
