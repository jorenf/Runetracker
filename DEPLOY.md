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
| `PORT` | `8080` | HTTP server port for `/health`, admin endpoints, and `/api/site*`. |
| `WOM_REQUESTS_PER_MINUTE` | `40` | Shared Wise Old Man request throttle. Values above `59` use the default. |
| `TRACKER_INTERVAL_MS` | `300000` | Tracker polling interval in milliseconds. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, or `debug`. |
| `WOM_API_KEY` | empty | Optional Wise Old Man API key. |
| `ADMIN_SECRET` | long random string | Optional secret for `/admin/*` endpoints. |
| `SITE_DIR` | `/site` | Optional external folder served as the public website. |
| `SITE_API_KEY` | long random string | Optional secret for `/api/site*` when the stats API should not be public. |
| `SITE_CORS_ORIGIN` | `https://example.com` | Optional CORS origin when the site is hosted separately. |

Keep all secrets out of GitHub issues, screenshots, logs, and commits.

The release update is posted once per guild on the next bot startup, if that
guild has a notifications channel configured. Its delivery marker is stored
with the guild config, so keep `DATA_DIR` persistent to prevent the announcement
from being repeated after a restart or redeploy.

## Railway

1. Create a Railway project.
2. Choose "Deploy from GitHub repo" and select this repository.
3. Add a persistent volume.
4. Mount the volume at `/data`.
5. Set `DATA_DIR=/data`.
6. Add the required Discord environment variables.
7. Add `WOM_API_KEY` with your Wise Old Man API key to authenticate WOM API
   requests and access the limits associated with that key. The bot sends it
   in the `x-api-key` header. Keep the value private; do not commit it.
8. Deploy or redeploy after setting the variables.

Railway should use `npm start` automatically from `package.json`.

### Website on Shared Hosting

When the bot runs on Railway and the website runs on shared hosting, keep
`SITE_DIR` empty on Railway. The website connects to Railway through
`https://api.runetracker.icu` and the sanitized `/api/site*` endpoints.

Railway environment variables:

```env
PORT=8080
SITE_CORS_ORIGIN=https://runetracker.icu,https://www.runetracker.icu
SITE_API_KEY=
```

After Railway deploys, test:

```text
https://api.runetracker.icu/health
https://api.runetracker.icu/api/site
```

Upload the external `site/RuneTracker.html` file to the shared host and point it
at Railway:

```text
https://runetracker.icu/RuneTracker.html?api=https://api.runetracker.icu
```

The current site template already defaults to `https://api.runetracker.icu`, so
renaming it to `index.html` on shared hosting is enough for the normal
`https://runetracker.icu` URL.

If `SITE_API_KEY` is set, the site can pass it with `&key=...` or with
`window.RUNETRACKER_SITE_KEY` in the HTML. Because browser-side keys are visible
to visitors, rely on the sanitized API response for privacy.

### Register Slash Commands on Railway

At startup, the bot replaces the global slash-command set with the definitions
in `src/commands` and clears guild-specific command copies, preventing duplicate
slash commands. This adds new commands and removes stale ones automatically.
Global commands can take up to an hour to propagate. `npm run deploy` remains
available for manual registration:

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

The next normal bot startup automatically removes the retired loot slash
commands from global and bot-joined guild registrations and deletes legacy
loot fields from saved guild JSON files. No manual Railway command is needed.

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
and tracked players, so treat backups as private.

Example daily backup:

```cron
0 2 * * * tar czf ~/backups/muskebeers-$(date +\%F).tar.gz ~/Muskebeers/data && find ~/backups -name '*.tar.gz' -mtime +7 -delete
```

## HTTP Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/health` | none |
| `GET` | `/api/site` | optional `SITE_API_KEY` |
| `GET` | `/api/site/commands` | optional `SITE_API_KEY` |
| `GET` | `/api/site/weekly-xp` | optional `SITE_API_KEY` |
| `GET` | `/admin/guilds?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |
| `GET` | `/admin/guilds/:id?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |
| `GET` | `/admin/stats?key=<ADMIN_SECRET>` | `ADMIN_SECRET` required |

Leave `ADMIN_SECRET` unset if you do not want admin HTTP endpoints enabled.
Leave `SITE_API_KEY` unset only if the sanitized public stats API may be public.
Set `SITE_DIR` when you want the bot process to serve the external site folder.

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

- If global slash commands do not appear immediately, Discord can take up to
  an hour to propagate them.
- Use `GUILD_ID` with `npm run deploy` for manual command updates to one test
  guild.
- If hosted data disappears after deploys, confirm `DATA_DIR` points to a
  persistent volume.
- If Wise Old Man calls fail, check Railway logs for the WOM API error and
  confirm the `WOM_API_KEY` variable is set correctly. The bot logs whether a
  key is configured, without logging its value.
- If Wise Old Man calls fail often, lower `WOM_REQUESTS_PER_MINUTE`.
