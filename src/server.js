import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const { app, pool } = createApp({ config });

await pool.query('SELECT 1');

const server = app.listen(config.port, () => {
  console.info(`API listening on port ${config.port}.`);
});

async function shutdown(signal) {
  console.info(`${signal} received. Shutting down.`);

  server.close(async () => {
    await pool.end();

    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
