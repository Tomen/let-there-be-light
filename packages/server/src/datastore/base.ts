import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import yaml from 'js-yaml';
import type { Entity } from '@let-there-be-light/shared';

// Custom errors
export class NotFoundError extends Error {
  constructor(public entityType: string, public id: string) {
    super(`${entityType} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(public expectedRevision: number, public actualRevision: number) {
    super(`Revision mismatch: expected ${expectedRevision}, found ${actualRevision}`);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Generic YAML-backed data store with optimistic concurrency.
 *
 * Features:
 * - Loads data from YAML file on first access (lazy loading)
 * - Caches data in memory for fast reads
 * - Writes back to YAML on every mutation (atomic via temp file)
 * - Optimistic concurrency via revision field
 */
export class YamlDataStore<T extends Entity> {
  private cache: Map<string, T> = new Map();
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly entityType: string,
  ) {}

  /**
   * Ensure data is loaded from disk
   */
  private ensureLoaded(): void {
    if (this.loaded) return;
    this.load();
  }

  /**
   * Load data from YAML file
   */
  private load(): void {
    this.cache.clear();

    if (!existsSync(this.filePath)) {
      // Create empty file if doesn't exist
      this.save();
      this.loaded = true;
      return;
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const data = yaml.load(content) as T[] | null;

      if (Array.isArray(data)) {
        for (const item of data) {
          this.cache.set(item.id, item);
        }
      }

      this.loaded = true;
    } catch (err) {
      throw new Error(`Failed to load ${this.entityType} from ${this.filePath}: ${err}`);
    }
  }

  /**
   * Save data to YAML file (atomic write via temp file)
   */
  private save(): void {
    const data = Array.from(this.cache.values());
    const content = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write to temp file first, then rename (atomic on most systems)
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, content, 'utf-8');

    // On Windows, we need to delete the target first
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
    renameSync(tempPath, this.filePath);
  }

  /**
   * Reload data from disk (useful for hot-reloading)
   */
  reload(): void {
    this.loaded = false;
    this.load();
  }

  /**
   * Get all entities
   */
  getAll(): T[] {
    this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  /**
   * Get entity by ID
   */
  getById(id: string): T | null {
    this.ensureLoaded();
    return this.cache.get(id) ?? null;
  }

  /**
   * Get entity by ID, throwing if not found
   */
  getByIdOrThrow(id: string): T {
    const entity = this.getById(id);
    if (!entity) {
      throw new NotFoundError(this.entityType, id);
    }
    return entity;
  }

  /**
   * Check if entity exists
   */
  exists(id: string): boolean {
    this.ensureLoaded();
    return this.cache.has(id);
  }

  /**
   * Create a new entity
   */
  create(data: Omit<T, 'id' | 'revision'>, id?: string): T {
    this.ensureLoaded();

    const entityId = id ?? crypto.randomUUID();

    if (this.cache.has(entityId)) {
      throw new ValidationError(`${this.entityType} with ID ${entityId} already exists`);
    }

    const entity = {
      ...data,
      id: entityId,
      revision: 1,
    } as T;

    this.cache.set(entityId, entity);
    this.save();

    return entity;
  }

  /**
   * Update an existing entity with optimistic concurrency
   */
  update(id: string, data: Partial<Omit<T, 'id' | 'revision'>>, expectedRevision: number): T {
    this.ensureLoaded();

    const existing = this.cache.get(id);
    if (!existing) {
      throw new NotFoundError(this.entityType, id);
    }

    if (existing.revision !== expectedRevision) {
      throw new ConflictError(expectedRevision, existing.revision);
    }

    const updated = {
      ...existing,
      ...data,
      id: existing.id, // Ensure ID can't be changed
      revision: existing.revision + 1,
    } as T;

    this.cache.set(id, updated);
    this.save();

    return updated;
  }

  /**
   * Delete an entity
   */
  delete(id: string): boolean {
    this.ensureLoaded();

    if (!this.cache.has(id)) {
      return false;
    }

    this.cache.delete(id);
    this.save();

    return true;
  }

  /**
   * Delete an entity, throwing if not found
   */
  deleteOrThrow(id: string): void {
    if (!this.delete(id)) {
      throw new NotFoundError(this.entityType, id);
    }
  }

  /**
   * Find entities matching a predicate
   */
  find(predicate: (entity: T) => boolean): T[] {
    this.ensureLoaded();
    return Array.from(this.cache.values()).filter(predicate);
  }

  /**
   * Find first entity matching a predicate
   */
  findOne(predicate: (entity: T) => boolean): T | null {
    this.ensureLoaded();
    for (const entity of this.cache.values()) {
      if (predicate(entity)) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Get count of entities
   */
  count(): number {
    this.ensureLoaded();
    return this.cache.size;
  }

  /**
   * Seed initial data (only if store is empty)
   */
  seed(data: T[]): void {
    this.ensureLoaded();

    if (this.cache.size > 0) {
      return; // Already has data
    }

    for (const item of data) {
      this.cache.set(item.id, item);
    }

    this.save();
  }
}
