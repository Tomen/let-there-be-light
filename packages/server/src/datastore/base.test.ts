import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { YamlDataStore, NotFoundError, ConflictError, ValidationError } from './base.js';

interface TestEntity {
  id: string;
  revision: number;
  name: string;
  value: number;
}

const TEST_DIR = join(import.meta.dirname, '../../test-data');
const TEST_FILE = join(TEST_DIR, 'test-entities.yaml');

describe('YamlDataStore', () => {
  let store: YamlDataStore<TestEntity>;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    store = new YamlDataStore<TestEntity>(TEST_FILE, 'TestEntity');
  });

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('create', () => {
    it('should create entity with generated ID', () => {
      const entity = store.create({ name: 'Test', value: 42 });

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Test');
      expect(entity.value).toBe(42);
      expect(entity.revision).toBe(1);
    });

    it('should create entity with specified ID', () => {
      const entity = store.create({ name: 'Test', value: 42 }, 'custom-id');

      expect(entity.id).toBe('custom-id');
    });

    it('should throw on duplicate ID', () => {
      store.create({ name: 'First', value: 1 }, 'same-id');

      expect(() => {
        store.create({ name: 'Second', value: 2 }, 'same-id');
      }).toThrow(ValidationError);
    });

    it('should persist to YAML file', () => {
      store.create({ name: 'Test', value: 42 });

      expect(existsSync(TEST_FILE)).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no entities', () => {
      const entities = store.getAll();

      expect(entities).toEqual([]);
    });

    it('should return all created entities', () => {
      store.create({ name: 'First', value: 1 });
      store.create({ name: 'Second', value: 2 });

      const entities = store.getAll();

      expect(entities).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return entity by ID', () => {
      const created = store.create({ name: 'Test', value: 42 }, 'test-id');

      const entity = store.getById('test-id');

      expect(entity).toEqual(created);
    });

    it('should return null for non-existent ID', () => {
      const entity = store.getById('non-existent');

      expect(entity).toBeNull();
    });
  });

  describe('getByIdOrThrow', () => {
    it('should return entity by ID', () => {
      const created = store.create({ name: 'Test', value: 42 }, 'test-id');

      const entity = store.getByIdOrThrow('test-id');

      expect(entity).toEqual(created);
    });

    it('should throw NotFoundError for non-existent ID', () => {
      expect(() => {
        store.getByIdOrThrow('non-existent');
      }).toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should update entity with correct revision', () => {
      const created = store.create({ name: 'Original', value: 1 }, 'test-id');

      const updated = store.update('test-id', { name: 'Updated' }, 1);

      expect(updated.name).toBe('Updated');
      expect(updated.value).toBe(1); // Unchanged
      expect(updated.revision).toBe(2);
    });

    it('should throw NotFoundError for non-existent ID', () => {
      expect(() => {
        store.update('non-existent', { name: 'Updated' }, 1);
      }).toThrow(NotFoundError);
    });

    it('should throw ConflictError for wrong revision', () => {
      store.create({ name: 'Original', value: 1 }, 'test-id');

      expect(() => {
        store.update('test-id', { name: 'Updated' }, 999);
      }).toThrow(ConflictError);
    });

    it('should not allow changing ID', () => {
      store.create({ name: 'Original', value: 1 }, 'test-id');

      const updated = store.update('test-id', { id: 'new-id' } as any, 1);

      expect(updated.id).toBe('test-id');
    });
  });

  describe('delete', () => {
    it('should delete existing entity', () => {
      store.create({ name: 'Test', value: 42 }, 'test-id');

      const result = store.delete('test-id');

      expect(result).toBe(true);
      expect(store.getById('test-id')).toBeNull();
    });

    it('should return false for non-existent entity', () => {
      const result = store.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('deleteOrThrow', () => {
    it('should delete existing entity', () => {
      store.create({ name: 'Test', value: 42 }, 'test-id');

      store.deleteOrThrow('test-id');

      expect(store.getById('test-id')).toBeNull();
    });

    it('should throw NotFoundError for non-existent entity', () => {
      expect(() => {
        store.deleteOrThrow('non-existent');
      }).toThrow(NotFoundError);
    });
  });

  describe('find', () => {
    it('should find entities matching predicate', () => {
      store.create({ name: 'Low', value: 10 }, 'low');
      store.create({ name: 'High', value: 100 }, 'high');
      store.create({ name: 'Medium', value: 50 }, 'medium');

      const highValue = store.find((e) => e.value > 50);

      expect(highValue).toHaveLength(1);
      expect(highValue[0].name).toBe('High');
    });
  });

  describe('exists', () => {
    it('should return true for existing entity', () => {
      store.create({ name: 'Test', value: 42 }, 'test-id');

      expect(store.exists('test-id')).toBe(true);
    });

    it('should return false for non-existent entity', () => {
      expect(store.exists('non-existent')).toBe(false);
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', () => {
      expect(store.count()).toBe(0);
    });

    it('should return correct count', () => {
      store.create({ name: 'First', value: 1 });
      store.create({ name: 'Second', value: 2 });
      store.create({ name: 'Third', value: 3 });

      expect(store.count()).toBe(3);
    });
  });

  describe('seed', () => {
    it('should seed data when empty', () => {
      const seedData: TestEntity[] = [
        { id: 'a', revision: 1, name: 'A', value: 1 },
        { id: 'b', revision: 1, name: 'B', value: 2 },
      ];

      store.seed(seedData);

      expect(store.count()).toBe(2);
      expect(store.getById('a')?.name).toBe('A');
    });

    it('should not overwrite existing data', () => {
      store.create({ name: 'Existing', value: 999 }, 'existing');

      const seedData: TestEntity[] = [
        { id: 'a', revision: 1, name: 'A', value: 1 },
      ];

      store.seed(seedData);

      expect(store.count()).toBe(1);
      expect(store.getById('existing')?.name).toBe('Existing');
    });
  });

  describe('persistence', () => {
    it('should persist data across store instances', () => {
      store.create({ name: 'Persistent', value: 42 }, 'test-id');

      // Create new store instance pointing to same file
      const newStore = new YamlDataStore<TestEntity>(TEST_FILE, 'TestEntity');

      const entity = newStore.getById('test-id');

      expect(entity?.name).toBe('Persistent');
      expect(entity?.value).toBe(42);
    });
  });

  describe('reload', () => {
    it('should reload data from disk', () => {
      store.create({ name: 'Original', value: 1 }, 'test-id');

      // Create another store and modify the file
      const otherStore = new YamlDataStore<TestEntity>(TEST_FILE, 'TestEntity');
      otherStore.update('test-id', { name: 'Modified' }, 1);

      // Reload first store
      store.reload();

      const entity = store.getById('test-id');
      expect(entity?.name).toBe('Modified');
    });
  });
});
