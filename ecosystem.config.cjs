/**
 * ecosystem.config.cjs
 * PM2 process configuration for Muskebeers Discord bot.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   ← run the printed command to survive reboots
 */

module.exports = {
  apps: [
    {
      name:         'muskebeers',
      script:       './index.js',
      interpreter:  'node',

      // Restart automatically if the process crashes.
      autorestart:  true,
      max_restarts: 10,
      min_uptime:   '10s',

      // Restart once per day (3:00 AM) to pick up any stale state.
      cron_restart: '0 3 * * *',

      // Load .env from the project root.
      env_file: '.env',

      // Pass NODE_ENV so the bot knows it's in production.
      env: {
        NODE_ENV: 'production',
      },

      // Write logs to ./logs/ (PM2 creates the folder automatically).
      out_file:  './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Rotate log files to avoid unbounded disk growth.
      // Requires: pm2 install pm2-logrotate
      // Configuration in pm2 set pm2-logrotate:max_size 20M
    },
  ],
};
