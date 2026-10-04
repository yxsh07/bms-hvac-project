// ============================================================================
// API ENTRY POINT
// Fastify application setup with all route plugins
// ============================================================================

import fastify from 'fastify';
import fp from 'fastify-plugin';
import { siteRoutesPlugin } from './routes/index.js';

// Fastify instance with logger disabled for production
const app = fastify({ logger: false });

// Register all route plugins
await app.register(siteRoutesPlugin);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`API server running on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();