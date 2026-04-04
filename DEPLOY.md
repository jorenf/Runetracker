# Deploying Muskebeers

Two options: **Railway** (easiest, free tier available) or a **self-managed Ubuntu VPS**.

---

## Option A – Railway (recommended)

Railway runs the bot as a container and manages restarts automatically.
The only extra step is attaching a Volume so guild data survives redeploys.

### A1. Create the project

1. Go to **https://railway.app** and create a new project.
2. Choose **Deploy from GitHub repo** → connect your fork of this repo.
3. Railway detects `package.json` and will use `npm start` automatically.

### A2. Add a persistent Volume

> Without this step every redeploy wipes all guild configs and snapshots.

1. In your Railway project, click **+ Add Service → Volume**.
2. Name it `muskebeers-data` (or anything).
3. Set the **Mount Path** to `/data`.
4. Railway attaches the volume to the bot container automatically.

### A3. Set environment variables

In the Railway project → **Variables** tab, add:

| Variable | Value |
|---|---|
| `DISCORD_TOKEN` | Your bot token |
| `DISCORD_CLIENT_ID` | Your app's Client ID |
| `DATA_DIR` | `/data` ← must match the Volume mount path |
| `WOM_API_KEY` | Optional |
| `TRACKER_INTERVAL_MS` | `300000` (5 min, or adjust) |
| `WOM_REQUESTS_PER_MINUTE` | `40` |
| `LOG_LEVEL` | `info` |

### A4. Register slash commands (one-time)

Railway's start command runs `npm start` (the bot). To register slash commands,
run a one-off command in the Railway shell or locally with your production token:

```bash
# Locally with production .env values:
DISCORD_TOKEN=... DISCORD_CLIENT_ID=... node deploy-commands.js
```

Or in Railway: open the service → **Settings → Start Command** → temporarily set
it to `node deploy-commands.js`, deploy once, then revert to `npm start`.

### A5. Deploy

Push to your main branch — Railway redeploys automatically.  
Check **Logs** to confirm the bot connects and the tracker starts.

### A6. Discord Developer Portal settings

Same as the VPS guide below (section 8).

---

## Option B – Ubuntu VPS (self-managed)

This guide walks through a fresh Ubuntu 22.04 / 24.04 VPS setup from zero to a
running, auto-restarting bot that survives reboots and serves any Discord server
that invites it.

---

## 1. Provision the VPS

Any provider works (Hetzner, DigitalOcean, Linode, etc.).  
The bot is lightweight — a **1 vCPU / 1 GB RAM / 10 GB disk** instance is plenty.

---

## 2. Install Node.js (via nvm)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or restart your session

# Install Node 22 LTS and set it as default
nvm install 22
nvm alias default 22
node -v   # should print v22.x.x
```

---

## 3. Install PM2

```bash
npm install -g pm2
```

---

## 4. Clone the repository

```bash
cd ~
git clone https://github.com/jorenf/muskebeers.git
cd muskebeers
npm install
```

---

## 5. Configure the environment

```bash
cp .env.example .env
nano .env
```

Fill in at minimum:

| Variable | Where to find it |
|---|---|
| `DISCORD_TOKEN` | Discord Developer Portal → Your App → Bot → Token |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → Your App → General Information → Application ID |
| `WOM_API_KEY` | Optional – https://wiseoldman.net/api-docs (free) |

Save with **Ctrl+O**, exit with **Ctrl+X**.

---

## 6. Register slash commands

This only needs to run once (or after you add/rename commands):

```bash
node deploy-commands.js
```

You should see `✅ Registered N slash commands globally.`

---

## 7. Start the bot with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save          # persist the process list across reboots
pm2 startup       # prints a command – copy and run it to enable auto-start
```

Verify the bot is running:

```bash
pm2 status
pm2 logs muskebeers --lines 50
```

---

## 8. Discord Developer Portal settings

1. Go to **https://discord.com/developers/applications** and open your app.
2. **Bot** tab:
   - Enable **Message Content Intent** (not required currently but useful for future).
   - Enable **Server Members Intent** (needed if you want member lookups later).
   - Toggle **Public Bot** ✅ so anyone can invite it.
3. **Installation** tab → **Install Link**:
   - Choose **Discord Provided Link**.
   - Under **Default Install Settings → Guild Install → Scopes**, add:  
     `bot` + `applications.commands`
   - Under **Bot Permissions**, select:  
     `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`  
     (permission integer **`84992`**)
4. Copy the **Install Link** and share it — users visit the link, pick their
   server, and the bot appears immediately.

---

## 9. Data layout on disk

```
data/
  guilds/
    {guild_id}.json   ← per-server settings (channel, players, admins, options)
  snapshots/
    {wom_id}.json     ← last known WOM snapshot per player (shared across guilds)
logs/
  out.log
  error.log
```

Back up the `data/` folder periodically:

```bash
# Example: daily tar backup kept for 7 days
0 2 * * * tar czf ~/backups/muskebeers-$(date +\%F).tar.gz ~/muskebeers/data && find ~/backups -name '*.tar.gz' -mtime +7 -delete
```

---

## 10. Useful PM2 commands

```bash
pm2 status                  # see all processes
pm2 logs muskebeers         # live log tail
pm2 logs muskebeers --lines 200  # last 200 lines
pm2 restart muskebeers      # restart after a code update
pm2 stop muskebeers         # pause without removing
pm2 delete muskebeers       # remove from PM2 entirely
```

---

## 11. Updating the bot

```bash
cd ~/muskebeers
git pull
npm install          # only needed if package.json changed
pm2 restart muskebeers
```

If you added or renamed slash commands, re-run:

```bash
node deploy-commands.js
pm2 restart muskebeers
```

---

## 12. Log rotation (optional but recommended)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 13. Firewall

The bot only makes **outbound** HTTPS requests (Discord API, WOM API) — no
inbound ports need to be opened beyond SSH.

```bash
ufw allow OpenSSH
ufw enable
ufw status
```
