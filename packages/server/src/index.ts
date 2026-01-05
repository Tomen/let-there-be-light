import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

import { initializeStores, getShowInfo } from './datastore/index.js';
import { fixtureRoutes } from './routes/fixtures.js';
import { groupRoutes } from './routes/groups.js';
import { graphRoutes } from './routes/graphs.js';
import { inputRoutes } from './routes/inputs.js';
import { showRoutes } from './routes/shows.js';
import { wsGateway } from './ws/gateway.js';
import { getEngine, initializeArtNetBridge, processFrame, shutdownArtNetBridge } from './runtime/index.js';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function start() {
  // Initialize data stores (creates YAML files if they don't exist)
  const stores = initializeStores();
  console.log(`Data stores initialized: ${stores.fixtures.count()} fixtures, ${stores.groups.count()} groups, ${stores.graphs.count()} graphs, ${stores.inputs.count()} inputs`);

  // Initialize Art-Net bridge for DMX output
  const artnetBroadcast = process.env.ARTNET_BROADCAST || '2.255.255.255';
  const artnetEnabled = process.env.ARTNET_ENABLED !== 'false';

  if (artnetEnabled) {
    try {
      await initializeArtNetBridge(artnetBroadcast);
      console.log(`Art-Net bridge initialized, broadcasting to ${artnetBroadcast}`);
    } catch (err) {
      console.warn('Art-Net bridge failed to initialize:', err);
      console.warn('DMX output will be disabled');
    }
  } else {
    console.log('Art-Net output disabled (ARTNET_ENABLED=false)');
  }

  // Initialize and start runtime engine
  const engine = getEngine();
  engine.reloadAllGraphs();

  // Connect frame output to Art-Net bridge
  engine.onFrame((frame) => {
    if (artnetEnabled) {
      processFrame(frame, artnetBroadcast);
    }
  });

  engine.start();
  console.log(`Runtime engine started: ${engine.getStats().loadedGraphs} graphs loaded`);

  // Register plugins
  await app.register(cors, {
    origin: true, // Allow all origins in development
  });
  await app.register(websocket);

  // Health check endpoint
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
  }));

  // Register REST routes
  await app.register(fixtureRoutes, { prefix: '/api/fixtures' });
  await app.register(groupRoutes, { prefix: '/api/groups' });
  await app.register(graphRoutes, { prefix: '/api/graphs' });
  await app.register(inputRoutes, { prefix: '/api/inputs' });
  await app.register(showRoutes, { prefix: '/api/shows' });

  // Register WebSocket gateway
  await app.register(wsGateway, { prefix: '/ws' });

  // Start server
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });

  const showInfo = getShowInfo();
  console.log(`
╔═══════════════════════════════════════════════════════╗
║     Let There Be Light - Control Server               ║
╠═══════════════════════════════════════════════════════╣
║  Show:        ${showInfo.show.padEnd(40)}║
║  REST API:    http://localhost:${port}/api              ║
║  WebSocket:   ws://localhost:${port}/ws                 ║
║  Health:      http://localhost:${port}/api/health       ║
║  Art-Net:     ${artnetEnabled ? artnetBroadcast.padEnd(40) : 'disabled'.padEnd(40)}║
╚═══════════════════════════════════════════════════════╝

Endpoints:
  GET    /api/fixtures        - List fixtures
  POST   /api/fixtures        - Create fixture
  GET    /api/fixtures/:id    - Get fixture
  PUT    /api/fixtures/:id    - Update fixture
  DELETE /api/fixtures/:id    - Delete fixture

  GET    /api/groups          - List groups
  POST   /api/groups          - Create group
  GET    /api/groups/:id      - Get group
  PUT    /api/groups/:id      - Update group
  DELETE /api/groups/:id      - Delete group

  GET    /api/graphs          - List graphs
  POST   /api/graphs          - Create graph
  GET    /api/graphs/:id      - Get graph
  PUT    /api/graphs/:id      - Update graph
  DELETE /api/graphs/:id      - Delete graph
  POST   /api/graphs/:id/compile - Compile graph

  GET    /api/inputs          - List inputs
  GET    /api/inputs/faders   - List faders
  GET    /api/inputs/buttons  - List buttons
  POST   /api/inputs          - Create input
  GET    /api/inputs/:id      - Get input
  PUT    /api/inputs/:id      - Update input
  DELETE /api/inputs/:id      - Delete input
  GET    /api/inputs/:id/usage - Check graph usage
`);
}

// Handle graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  const engine = getEngine();
  engine.stop();
  await shutdownArtNetBridge(); // Sends blackout before closing
  await app.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
