import type { FastifyPluginAsync } from 'fastify';
import type { Fixture, FixtureModel, ApiResponse, CreateRequest, UpdateRequest } from '@let-there-be-light/shared';
import { getStores, NotFoundError, ConflictError, ValidationError } from '../datastore/index.js';

export const fixtureRoutes: FastifyPluginAsync = async (app) => {
  const { fixtures } = getStores();

  // GET /api/fixtures - List all fixtures
  app.get('/', async (): Promise<ApiResponse<Fixture[]>> => {
    return { data: fixtures.getAll() };
  });

  // GET /api/fixtures/models - List all fixture models
  app.get('/models', async (): Promise<ApiResponse<FixtureModel[]>> => {
    return { data: fixtures.getModels() };
  });

  // POST /api/fixtures - Create fixture
  app.post<{ Body: CreateRequest<Fixture> }>('/', async (req, reply) => {
    try {
      const fixture = fixtures.create(req.body);
      return reply.code(201).send({ data: fixture });
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // GET /api/fixtures/:id - Get fixture by ID
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const fixture = fixtures.getByIdOrThrow(req.params.id);
      return { data: fixture };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // PUT /api/fixtures/:id - Update fixture
  app.put<{ Params: { id: string }; Body: UpdateRequest<Fixture> }>('/:id', async (req, reply) => {
    try {
      const updated = fixtures.update(req.params.id, req.body.data, req.body.revision);
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

  // DELETE /api/fixtures/:id - Delete fixture
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      // Also remove from any groups
      const { groups } = getStores();
      groups.removeFixtureFromAll(req.params.id);

      fixtures.deleteOrThrow(req.params.id);
      return { success: true };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });
};
