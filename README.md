# Muskebeers OSRS Discord Bot

Muskebeers is a Discord bot for Old School RuneScape communities. It tracks
players through the Wise Old Man API, posts progress updates, builds weekly XP
leaderboards, and exposes live tracker data through a site API.

## Features

- Track OSRS players by Wise Old Man player ID, so name changes keep working.
- Poll the official OSRS hiscores first for skills, clue scores, and boss KC,
  with Wise Old Man as a fallback when a hiscores lookup is unavailable.
- Route WOM API calls through a shared bounded queue and honor `Retry-After`
  responses to avoid exceeding its public request limit.
- Post level-ups, boss kill count increases, clue completions, achievements,
  total-level milestones, level 99s, and boss KC milestones.
- Link a Wise Old Man group and sync members automatically.
- Post weekly XP leaderboards with Wise Old Man's rolling `week` gains period.
- Expose a sanitized public site API for live website stats, command lists, and
  leaderboards.
- Store guild settings and snapshots in local JSON files under `DATA_DIR`.
- Expose health and optional admin HTTP endpoints for hosted deployments.

## Requirements

- Node.js 22.x
- A Discord application and bot token
- Network access to Discord, OSRS hiscores, and Wise Old Man

## Quick Start

```bash
git clone https://github.com/jorenf/Muskebeers.git
cd Muskebeers
npm install
cp .env.example .env
```

Edit `.env` and set at least:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
```

Register slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

## Discord Setup

1. Create an application in the Discord Developer Portal.
2. Add a bot and copy its token into `DISCORD_TOKEN`.
3. Copy the application ID into `DISCORD_CLIENT_ID`.
4. Invite the bot with these scopes:
   - `bot`
   - `applications.commands`
5. Recommended bot permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History

The bot only uses slash commands and the `Guilds` gateway intent.

## Configuration

All runtime configuration comes from environment variables.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | none | Discord bot token. |
| `DISCORD_CLIENT_ID` | Yes | none | Discord application/client ID. |
| `GUILD_ID` | No | none | Registers slash commands to one guild for fast development when running `npm run deploy`. |
| `WOM_API_KEY` | No | none | Wise Old Man API key for higher rate limits. |
| `WOM_REQUESTS_PER_MINUTE` | No | `40` | Shared Wise Old Man request throttle. Values above `59` or invalid values use the default. |
| `TRACKER_INTERVAL_MS` | No | `300000` | Background polling interval in milliseconds. |
| `DATA_DIR` | No | `./data` | Directory for guild configs, snapshots, and cooldowns. |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, or `debug`. |
| `PORT` | No | `8080` | HTTP server port for health, admin endpoints, and the site API. |
| `ADMIN_SECRET` | No | none | Enables `/admin/*` HTTP endpoints when set. |
| `SITE_DIR` | No | none | Optional folder to serve as the public website, for example `../site`. |
| `SITE_API_KEY` | No | none | Optional key required by `/api/site*` via `X-Site-Key` or `?key=`. |
| `SITE_CORS_ORIGIN` | No | `https://runetracker.icu,https://www.runetracker.icu` | CORS origin for the sanitized public site API. |
| `SITE_WEEKLY_CACHE_MS` | No | `900000` | Cache duration for Wise Old Man weekly XP lookups used by the site. |

Never commit `.env`, `data/`, `logs/`, tokens, or production snapshots.

## Commands

| Command | Description |
| --- | --- |
| `/setup` | Interactive first-time setup with review before saving. |
| `/setchannel` | Set the channel for tracking updates. |
| `/track` | Start tracking a player. |
| `/untrack` | Stop tracking a player. |
| `/setgroup` | Link a Wise Old Man group and import members. |
| `/trackoption` | Enable or disable notification categories. |
| `/spamfilter` | Configure notification thresholds and cooldowns. |
| `/weeklytop` | Post the weekly XP leaderboard. |
| `/lookup` | Show an OSRS hiscores player overview, with Wise Old Man fallback. |
| `/status` | Show tracker status and snapshot times. |
| `/settings` | Interactive server settings dashboard. |
| `/checkupdate` | Manually trigger updates. |
| `/help` | Show command help. |

## HTTP Endpoints

The bot starts an Express server from `src/http/server.js`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Hosting health check. |
| `GET` | `/api/site` | optional `SITE_API_KEY` | Sanitized live website data: summary, guilds, leaderboards, and commands. |
| `GET` | `/api/site/commands` | optional `SITE_API_KEY` | Slash command catalog generated from the bot command definitions. |
| `GET` | `/api/site/weekly-xp` | optional `SITE_API_KEY` | Cached Wise Old Man weekly XP leaderboard for tracked players. |
| `GET` | `/admin/guilds?key=<ADMIN_SECRET>` | query key | Admin overview when `ADMIN_SECRET` is configured. |
| `GET` | `/admin/guilds/:id?key=<ADMIN_SECRET>` | query key | Admin detail for one guild. |
| `GET` | `/admin/stats?key=<ADMIN_SECRET>` | query key | High-level admin stats. |

The site API intentionally omits private fields such as admin user IDs, raw
guild files, and cooldown data. If the site is hosted by
the bot itself, set `SITE_DIR` to the external site folder.

## Website Hosting

The website can be hosted separately from the bot, for example on shared
hosting while the bot runs on Railway.

1. Deploy the bot and enable the public Railway domain `https://api.runetracker.icu`.
2. Set `SITE_CORS_ORIGIN` to the website origin, for example
   `https://runetracker.icu,https://www.runetracker.icu`.
3. Leave `SITE_DIR` empty when the website is not served by the bot process.
4. Open the website with the bot API base in the query string:
   `https://runetracker.icu/RuneTracker.html?api=https://api.runetracker.icu`.

The bundled site template already defaults to `https://api.runetracker.icu`, so
the query string is only needed for testing another API host.

If `SITE_API_KEY` is configured, add `&key=<SITE_API_KEY>` or set
`window.RUNETRACKER_SITE_KEY` in the HTML. Browser-side keys are visible to
visitors, so they are useful only as light abuse protection; the API response is
sanitized by design.

## Data Storage

Data is stored as JSON files. This keeps deployment simple and avoids native
database dependencies.

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

Back up `DATA_DIR` before redeploys or server moves. On Railway or similar
hosts, mount a persistent volume and set `DATA_DIR` to that path.

## Development

```bash
npm install
npm test
node --check index.js
```

Use a guild-scoped command deploy while developing:

```bash
GUILD_ID=your_test_guild_id npm run deploy
```

On Windows PowerShell:

```powershell
$env:GUILD_ID='your_test_guild_id'; npm run deploy
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for Railway and VPS deployment notes.

For PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Security

- Keep Discord, Wise Old Man, and admin tokens secret.
- Treat `data/` as private because it contains guild IDs, tracked player lists,
  admin IDs, and tracker history.
- Rotate any token that was exposed in logs, screenshots, issues, or commits.
- Report vulnerabilities privately using the guidance in [SECURITY.md](./SECURITY.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before
opening an issue or pull request.

## License

MIT. See [LICENSE](./LICENSE).
