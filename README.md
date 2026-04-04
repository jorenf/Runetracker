# Muskebeers – OSRS Discord Tracking Bot

A production-ready Discord bot that tracks Old School RuneScape players via the
[WiseOldMan API](https://wiseoldman.net/) and posts updates in your server.

---

## Features

| Command | Description |
|---|---|
| `/setchannel #channel` | Set the channel where tracking updates are posted *(admin only)* |
| `/track <username>` | Start tracking an OSRS player *(admin only)* |
| `/trackoption [category] [enabled]` | Enable/disable notification categories *(admin only)* |

**Tracked categories**

- Level-ups (any skill)
- Boss kill count increases
- WiseOldMan achievement unlocks
- Clue scroll completions (all tiers)

**Automatic username change detection** – the bot uses the WOM player ID as
the stable key, so if a player renames themselves it keeps tracking and posts a
name-change notification.

---

## Project structure

```
muskebeers/
├── index.js                  # Entry point
├── deploy-commands.js        # One-time slash command registration
├── package.json
├── .env.example
└── src/
    ├── commands/
    │   ├── setchannel.js
    │   ├── track.js
    │   └── trackoption.js
    ├── events/
    │   ├── ready.js
    │   └── interactionCreate.js
    ├── services/
    │   ├── wom.js            # WiseOldMan API wrapper
    │   ├── tracker.js        # Background polling + diff logic
    │   └── notifier.js       # Discord embed dispatch
    ├── db/
    │   └── index.js          # SQLite schema + prepared statements
    └── utils/
        ├── logger.js
        └── embeds.js
```

---

## Prerequisites

- **Node.js 18+** (uses native `fetch`)
- A Discord bot token
- An internet connection (to reach the WiseOldMan API)

---

## Step 1 – Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, give it a name (e.g. *Muskebeers*).
3. Navigate to **Bot** → click **Add Bot**.
4. Under **Privileged Gateway Intents**, no extra intents are needed.
5. Copy the **Token** – this is your `DISCORD_TOKEN`.
6. On the **OAuth2 → General** page, copy the **Application ID** – this is your
   `DISCORD_CLIENT_ID`.
7. Navigate to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `View Channel`
8. Open the generated URL to invite the bot to your server.

---

## Step 2 – Installation

```bash
# Clone the repo (or extract the project folder)
git clone <repo-url>
cd muskebeers

# Install dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env
```

---

## Step 3 – Configure `.env`

Edit the `.env` file:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Optional – get one at https://wiseoldman.net/ for higher rate limits
WOM_API_KEY=

# How often to poll WOM (ms). Default 5 minutes.
TRACKER_INTERVAL_MS=300000

# Delay between WOM requests (ms). Default 1.5 s. Don't go below 1000.
WOM_REQUEST_DELAY_MS=1500

# SQLite file path
DB_PATH=./data/muskebeers.db

# Log level: debug | info | warn | error
LOG_LEVEL=info
```

---

## Step 4 – Register Slash Commands

Run this **once** (and again whenever you change a command's definition):

```bash
npm run deploy
```

> For instant updates during development, register to a single guild:
> ```bash
> GUILD_ID=your_guild_id npm run deploy
> ```

---

## Step 5 – Run the Bot

```bash
npm start
```

For production, use a process manager such as [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name muskebeers
pm2 save
pm2 startup   # auto-start on server reboot
```

Or with Docker:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "index.js"]
```

---

## Step 6 – Set Up Your Server

Once the bot is running and has joined your server:

1. **Set the announcement channel**
   ```
   /setchannel #osrs-updates
   ```

2. **Track a player**
   ```
   /track zezima
   ```

3. *(Optional)* **Customise notifications**
   ```
   /trackoption             (view current settings)
   /trackoption category:bosses enabled:false
   /trackoption category:clues  enabled:true
   ```

---

## Database

Data is stored as a JSON file (no native dependencies, works on all platforms).
The file is created automatically at the path configured in `DB_PATH`
(default `./data/muskebeers.json`).

| Collection | Purpose |
|---|---|
| `guilds` | Guild → announcement channel mapping |
| `players` | Tracked players per guild |
| `tracking_options` | Per-guild notification toggles |
| `player_snapshots` | Last known stats snapshot per player |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | – | Discord bot token |
| `DISCORD_CLIENT_ID` | ✅ | – | Discord application ID |
| `WOM_API_KEY` | ❌ | – | WiseOldMan API key (optional) |
| `TRACKER_INTERVAL_MS` | ❌ | `300000` | Poll interval in milliseconds |
| `WOM_REQUEST_DELAY_MS` | ❌ | `1500` | Delay between WOM requests (ms) |
| `DB_PATH` | ❌ | `./data/muskebeers.json` | Path to JSON data file |
| `LOG_LEVEL` | ❌ | `info` | Minimum log level |
