import type { FastifyPluginAsync } from 'fastify';
import type { Group, ApiResponse, CreateRequest, UpdateRequest } from '@let-there-be-light/shared';
import { getStores, NotFoundError, ConflictError, ValidationError } from '../datastore/index.js';

export const groupRoutes: FastifyPluginAsync = async (app) => {
  const { groups } = getStores();

  // GET /api/groups - List all groups
  app.get('/', async (): Promise<ApiResponse<Group[]>> => {
    return { data: groups.getAll() };
  });

  // POST /api/groups - Create group
  app.post<{ Body: CreateRequest<Group> }>('/', async (req, reply) => {
    try {
      const group = groups.create(req.body);
      return reply.code(201).send({ data: group });
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // GET /api/groups/:id - Get group by ID
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const group = groups.getByIdOrThrow(req.params.id);
      return { data: group };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // PUT /api/groups/:id - Update group
  app.put<{ Params: { id: string }; Body: UpdateRequest<Group> }>('/:id', async (req, reply) => {
    try {
      const updated = groups.update(req.params.id, req.body.data, req.body.revision);
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

  // DELETE /api/groups/:id - Delete group
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      groups.deleteOrThrow(req.params.id);
      return { success: true };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });
};
