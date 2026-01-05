import type { FastifyPluginAsync } from 'fastify';
import type { Graph, ApiResponse, CreateRequest, UpdateRequest } from '@let-there-be-light/shared';
import { getStores, NotFoundError, ConflictError, ValidationError } from '../datastore/index.js';
import { compileGraph } from '../graph/index.js';
import { getEngine } from '../runtime/index.js';

export const graphRoutes: FastifyPluginAsync = async (app) => {
  const { graphs } = getStores();

  // GET /api/graphs - List all graphs
  app.get('/', async (): Promise<ApiResponse<Graph[]>> => {
    return { data: graphs.getAll() };
  });

  // POST /api/graphs - Create graph
  app.post<{ Body: CreateRequest<Graph> }>('/', async (req, reply) => {
    try {
      const graph = graphs.create(req.body);
      return reply.code(201).send({ data: graph });
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // GET /api/graphs/:id - Get graph by ID
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const graph = graphs.getByIdOrThrow(req.params.id);
      return { data: graph };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // PUT /api/graphs/:id - Update graph
  app.put<{ Params: { id: string }; Body: UpdateRequest<Graph> }>('/:id', async (req, reply) => {
    try {
      const updated = graphs.update(req.params.id, req.body.data, req.body.revision);

      // Reload graph in runtime engine so changes take effect
      getEngine().reloadGraph(req.params.id);

      return { data: updated };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      if (err instanceof ConflictError) {
        return reply.code(409).send({ error: err.message, code: 'CONFLICT' });
      }
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // DELETE /api/graphs/:id - Delete graph
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      graphs.deleteOrThrow(req.params.id);
      return { success: true };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // POST /api/graphs/:id/compile - Compile graph
  app.post<{ Params: { id: string } }>('/:id/compile', async (req, reply) => {
    try {
      const graph = graphs.getByIdOrThrow(req.params.id);
      const result = compileGraph(graph);

      // Reload graph in runtime engine if compile succeeded
      if (result.ok) {
        getEngine().reloadGraph(req.params.id);
      }

      return { data: result };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });
};
