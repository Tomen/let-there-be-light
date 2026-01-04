import type { GraphId, NodeId, FixtureId, GroupId, PresetId } from './domain.js';

// Standard API response wrapper
export interface ApiResponse<T> {
  data: T;
}

// API error response
export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

// Error codes
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT' // Revision mismatch
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

// Compile error codes
export type CompileErrorCode =
  | 'CYCLE_DETECTED'
  | 'MISSING_CONNECTION'
  | 'TYPE_MISMATCH'
  | 'INVALID_PARAM'
  | 'UNKNOWN_NODE_TYPE'
  | 'UNKNOWN_REFERENCE'; // Unknown preset, fixture, group, etc.

// Compile error (returned by graph compiler)
export interface CompileError {
  nodeId: NodeId;
  port?: string;
  message: string;
  code: CompileErrorCode;
}

// Graph dependencies (external references used by graph)
export interface GraphDependencies {
  faderIds: string[];
  buttonIds: string[];
  presetIds: PresetId[];
  groupIds: GroupId[];
  fixtureIds: FixtureId[];
}

// Compile result (returned by POST /api/graphs/:id/compile)
export interface CompileResult {
  ok: boolean;
  errors: CompileError[];
  dependencies: GraphDependencies;
}

// List response with pagination (for future use)
export interface ListResponse<T> {
  data: T[];
  total: number;
}

// Create request (without id/revision)
export type CreateRequest<T> = Omit<T, 'id' | 'revision'>;

// Update request (requires revision for optimistic concurrency)
export interface UpdateRequest<T> {
  data: Partial<Omit<T, 'id' | 'revision'>>;
  revision: number;
}
