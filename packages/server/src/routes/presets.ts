import type { FastifyPluginAsync } from 'fastify';
import type { Preset, ApiResponse, CreateRequest, UpdateRequest } from '@let-there-be-light/shared';
import { getStores, NotFoundError, ConflictError, ValidationError } from '../datastore/index.js';

export const presetRoutes: FastifyPluginAsync = async (app) => {
  const { presets } = getStores();

  // GET /api/presets - List all presets
  app.get('/', async (): Promise<ApiResponse<Preset[]>> => {
    return { data: presets.getAll() };
  });

  // GET /api/presets/by-type/:type - List presets by type
  app.get<{ Params: { type: Preset['type'] } }>('/by-type/:type', async (req): Promise<ApiResponse<Preset[]>> => {
    return { data: presets.getByType(req.params.type) };
  });

  // POST /api/presets - Create preset
  app.post<{ Body: CreateRequest<Preset> }>('/', async (req, reply) => {
    try {
      const preset = presets.create(req.body);
      return reply.code(201).send({ data: preset });
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // GET /api/presets/:id - Get preset by ID
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const preset = presets.getByIdOrThrow(req.params.id);
      return { data: preset };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // PUT /api/presets/:id - Update preset
  app.put<{ Params: { id: string }; Body: UpdateRequest<Preset> }>('/:id', async (req, reply) => {
    try {
      const updated = presets.update(req.params.id, req.body.data, req.body.revision);
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

  // DELETE /api/presets/:id - Delete preset
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      presets.deleteOrThrow(req.params.id);
      return { success: true };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });
};
