import type { FastifyPluginAsync } from 'fastify';
import type { Input, ApiResponse, CreateRequest, UpdateRequest } from '@let-there-be-light/shared';
import { getStores, NotFoundError, ConflictError, ValidationError } from '../datastore/index.js';
import { extractDependencies } from '../graph/index.js';

// Response type for usage check
interface InputUsage {
  inputId: string;
  usedBy: Array<{ graphId: string; graphName: string }>;
}

export const inputRoutes: FastifyPluginAsync = async (app) => {
  const { inputs, graphs } = getStores();

  // GET /api/inputs - List all inputs
  app.get('/', async (): Promise<ApiResponse<Input[]>> => {
    return { data: inputs.getAll() };
  });

  // GET /api/inputs/faders - List faders only
  app.get('/faders', async (): Promise<ApiResponse<Input[]>> => {
    return { data: inputs.getFaders() };
  });

  // GET /api/inputs/buttons - List buttons only
  app.get('/buttons', async (): Promise<ApiResponse<Input[]>> => {
    return { data: inputs.getButtons() };
  });

  // POST /api/inputs - Create input
  app.post<{ Body: CreateRequest<Input> }>('/', async (req, reply) => {
    try {
      const input = inputs.create(req.body);
      return reply.code(201).send({ data: input });
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
      }
      throw err;
    }
  });

  // GET /api/inputs/:id - Get input by ID
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const input = inputs.getByIdOrThrow(req.params.id);
      return { data: input };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }
  });

  // GET /api/inputs/:id/usage - Check which graphs use this input
  app.get<{ Params: { id: string } }>('/:id/usage', async (req, reply) => {
    const inputId = req.params.id;

    // Verify input exists
    try {
      inputs.getByIdOrThrow(inputId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }

    // Scan all graphs for usage
    const usedBy: Array<{ graphId: string; graphName: string }> = [];
    const allGraphs = graphs.getAll();

    for (const graph of allGraphs) {
      const deps = extractDependencies(graph);
      if (deps.faderIds.includes(inputId) || deps.buttonIds.includes(inputId)) {
        usedBy.push({ graphId: graph.id, graphName: graph.name });
      }
    }

    const usage: InputUsage = { inputId, usedBy };
    return { data: usage };
  });

  // PUT /api/inputs/:id - Update input (rename)
  app.put<{ Params: { id: string }; Body: UpdateRequest<Input> }>('/:id', async (req, reply) => {
    try {
      const updated = inputs.update(req.params.id, req.body.data, req.body.revision);
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

  // DELETE /api/inputs/:id - Delete input (with usage check)
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const inputId = req.params.id;

    // First check if input exists
    try {
      inputs.getByIdOrThrow(inputId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      throw err;
    }

    // Check for usage in graphs
    const usedBy: string[] = [];
    const allGraphs = graphs.getAll();

    for (const graph of allGraphs) {
      const deps = extractDependencies(graph);
      if (deps.faderIds.includes(inputId) || deps.buttonIds.includes(inputId)) {
        usedBy.push(graph.name);
      }
    }

    if (usedBy.length > 0) {
      return reply.code(400).send({
        error: `Cannot delete input: used by ${usedBy.length} graph(s): ${usedBy.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
    }

    inputs.deleteOrThrow(inputId);
    return { success: true };
  });
};
