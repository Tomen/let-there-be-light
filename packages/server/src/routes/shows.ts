import type { FastifyPluginAsync } from 'fastify';
import type { Show, CurrentShow, ApiResponse } from '@let-there-be-light/shared';
import { listShows, switchShow, getShowInfo } from '../datastore/index.js';
import { getEngine } from '../runtime/index.js';
import { broadcastShowChange } from '../ws/gateway.js';

export const showRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/shows - List all available shows
  app.get('/', async (): Promise<ApiResponse<Show[]>> => {
    return { data: listShows() };
  });

  // GET /api/shows/current - Get current show info
  app.get('/current', async (): Promise<ApiResponse<CurrentShow>> => {
    const info = getShowInfo();
    return { data: { show: info.show, dataDir: info.dataDir } };
  });

  // POST /api/shows/:name/activate - Switch to a different show
  app.post<{ Params: { name: string } }>('/:name/activate', async (req, reply) => {
    const { name } = req.params;

    try {
      const engine = getEngine();

      // 1. Unload all graphs from runtime
      engine.unloadAllGraphs();

      // 2. Switch datastores to new show
      switchShow(name);

      // 3. Reload all graphs from new show
      engine.reloadAllGraphs();

      // 4. Broadcast show change to all WebSocket clients
      broadcastShowChange(name);

      return { data: { show: name } };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Show not found')) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });
};
