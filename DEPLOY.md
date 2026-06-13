# Deployment Guide

This guide covers two common deployment paths for Muskebeers:

- Railway or another container host
- A self-managed Ubuntu VPS with PM2

Before deploying, create a Discord application, add a bot, and invite it with
the `bot` and `applications.commands` scopes.

## Required Environment Variables

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token. |
| `DISCORD_CLIENT_ID` | Discord application/client ID. |

## Recommended Environment Variables

| Variable | Example | Description |
| --- | --- | --- |
| `DATA_DIR` | `/data` | Persistent storage path for guild configs and snapshots. |
| `PORT` | `3000` | HTTP server port for `/health`, `/webhook/loot`, and admin endpoints. |
| `WOM_REQUESTS_PER_MINUTE` | `40` | Wise Old Man request throttle. |
| `TRACKER_INTERVAL_MS` | `300000` | Tracker polling interval in milliseconds. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, or `debug`. |
| `WOM_API_KEY` | empty | Optional Wise Old Man API key. |
| `ADMIN_SECRET` | long random string | Optional secret for `/admin/*` endpoints. |

Keep all secrets out of GitHub issues, screenshots, logs, and commits.

## Railway

1. Create a Railway project.
2. Choose "Deploy from GitHub repo" and select this repository.
3. Add a persistent volume.
4. Mount the volume at `/data`.
5. Set `DATA_DIR=/data`.
6. Add the required Discord environment variables.
7. Deploy.

Railway should use `npm start` automatically from `package.json`.

### Register Slash Commands on Railway

Slash commands must be registered once, and again after command definitions
change.

The simplest local command is:

```bash
DISCORD_TOKEN=... DISCORD_CLIENT_ID=... npm run deploy
```

For development, register commands to one test guild:

```bash
DISCORD_TOKEN=... DISCORD_CLIENT_ID=... GUILD_ID=... npm run deploy
```

On Windows PowerShell:

```powershell
$env:DISCORD_TOKEN='...'
$env:DISCORD_CLIENT_ID='...'
$env:GUILD_ID='...'
npm run deploy
```

## Ubuntu VPS with PM2

These commands assume Ubuntu 22.04 or 24.04.

### Install Node.js 22

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node -v
```

### Install and Configure the Bot

```bash
cd ~
git clone https://github.com/jorenf/Muskebeers.git
cd Muskebeers
npm install
cp .env.example .env
nano .env
```

Set at least `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`.

Register commands:

```bash
npm run deploy
```

### Run with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Check logs:

```bash
pm2 status
pm2 logs muskebeers --lines 100
```

Restart after updates:

```bash
git pull
npm install
pm2 restart muskebeers
```

If commands changed:

```bash
npm run deploy
pm2 restart muskebeers
```

## Data Persistence

The bot stores runtime data in JSON files:

```text
data/
  guilds/
    {guild_id}.json
  snapshots/
    {wom_id}.json
logs/
  out.log
  error.log
```

Back up `DATA_DIR` regularly. The files may contain guild IDs, admin user IDs,
loot webhook tokens, tracked players, and loot history, so treat backups as
private.

Example daily backup:

```cron
0 2 * * * tar czf ~/backups/muskebeers-$(date +\%F).tar.gz ~/Muskebeers/data && find ~/backups -name '*.tar.gz' -mtime +7 -delete
```

## HTTP Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/health` | none |
| `POST` | `/webhook/loot` | `Authorization: Bearer <loot token>` |
| `GET` | `/admin/guilds?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |
| `GET` | `/admin/guilds/:id?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |
| `GET` | `/admin/stats?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |

Leave `ADMIN_SECRET` unset if you do not want admin HTTP endpoints enabled.

## Discord Application Settings

In the Discord Developer Portal:

1. Open your application.
2. Go to the Bot page.
3. Keep "Public Bot" enabled if others should be able to invite it.
4. Go to Installation or OAuth2 URL Generator.
5. Add scopes `bot` and `applications.commands`.
6. Add bot permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History

The bot currently uses slash commands only, so it does not require Message
Content Intent.

## Troubleshooting

- If slash commands do not appear, global registration can take up to an hour.
- Use `GUILD_ID` for instant command updates in a test guild.
- If hosted data disappears after deploys, confirm `DATA_DIR` points to a
  persistent volume.
- If Wise Old Man calls fail often, lower `WOM_REQUESTS_PER_MINUTE`.
- If loot webhooks return 401, regenerate the loot token with `/loottoken`.
