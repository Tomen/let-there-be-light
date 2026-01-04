import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FixtureStore } from './fixtures.js';
import { ValidationError } from './base.js';

const TEST_DIR = join(import.meta.dirname, '../../test-data-fixtures');

describe('FixtureStore', () => {
  let store: FixtureStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    store = new FixtureStore(TEST_DIR);
    store.initialize();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('initialization', () => {
    it('should seed default fixtures', () => {
      const fixtures = store.getAll();

      expect(fixtures.length).toBeGreaterThan(0);
    });

    it('should seed default models', () => {
      const models = store.getModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models.find((m) => m.id === 'generic-rgbw')).toBeDefined();
    });
  });

  describe('getModels', () => {
    it('should return all fixture models', () => {
      const models = store.getModels();

      expect(models).toContainEqual(
        expect.objectContaining({ id: 'generic-rgbw' })
      );
    });
  });

  describe('getModel', () => {
    it('should return model by ID', () => {
      const model = store.getModel('generic-rgbw');

      expect(model).toBeDefined();
      expect(model?.channels).toHaveProperty('red');
    });

    it('should return null for non-existent model', () => {
      const model = store.getModel('non-existent');

      expect(model).toBeNull();
    });
  });

  describe('create', () => {
    it('should create fixture with valid model', () => {
      const fixture = store.create({
        name: 'Test Fixture',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 100,
      });

      expect(fixture.id).toBeDefined();
      expect(fixture.name).toBe('Test Fixture');
    });

    it('should throw for invalid model', () => {
      expect(() => {
        store.create({
          name: 'Test',
          modelId: 'non-existent-model',
          universe: 0,
          startChannel: 1,
        });
      }).toThrow(ValidationError);
    });

    it('should throw for invalid universe', () => {
      expect(() => {
        store.create({
          name: 'Test',
          modelId: 'generic-rgbw',
          universe: -1,
          startChannel: 1,
        });
      }).toThrow(ValidationError);
    });

    it('should throw for invalid start channel', () => {
      expect(() => {
        store.create({
          name: 'Test',
          modelId: 'generic-rgbw',
          universe: 0,
          startChannel: 0,
        });
      }).toThrow(ValidationError);

      expect(() => {
        store.create({
          name: 'Test',
          modelId: 'generic-rgbw',
          universe: 0,
          startChannel: 513,
        });
      }).toThrow(ValidationError);
    });
  });

  describe('getByUniverse', () => {
    it('should filter fixtures by universe', () => {
      store.create({ name: 'U0', modelId: 'generic-rgbw', universe: 0, startChannel: 100 });
      store.create({ name: 'U1', modelId: 'generic-rgbw', universe: 1, startChannel: 1 });

      const u0Fixtures = store.getByUniverse(0);
      const u1Fixtures = store.getByUniverse(1);

      // Includes default fixtures on universe 0
      expect(u0Fixtures.length).toBeGreaterThanOrEqual(1);
      expect(u1Fixtures).toHaveLength(1);
      expect(u1Fixtures[0].name).toBe('U1');
    });
  });

  describe('getByModel', () => {
    it('should filter fixtures by model', () => {
      const fixtures = store.getByModel('generic-rgbw');

      expect(fixtures.length).toBeGreaterThan(0);
      fixtures.forEach((f) => {
        expect(f.modelId).toBe('generic-rgbw');
      });
    });
  });
});
