/**
 * RuneTracker HTTP server — drop this file next to your index.js
 * and call startHttpServer() before your Discord client.login() call.
 *
 * Requires:  npm install express
 */

import express from 'express';
import webhookRouter from './routes/webhook.js';

export function startHttpServer() {
  const app = express();

  // Parse JSON bodies up to 10 KB — more than enough for loot payloads
  app.use(express.json({ limit: '10kb' }));

  // Railway / uptime-robot health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'runetracker' });
  });

  app.use('/webhook', webhookRouter);

  // 404 catch-all for unknown routes
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[RuneTracker] HTTP server listening on port ${port}`);
  });
}
