import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PresetStore } from './presets.js';
import { ValidationError } from './base.js';

const TEST_DIR = join(import.meta.dirname, '../../test-data-presets');

describe('PresetStore', () => {
  let store: PresetStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    store = new PresetStore(TEST_DIR);
    store.initialize();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('initialization', () => {
    it('should seed default presets', () => {
      const presets = store.getAll();

      expect(presets.length).toBeGreaterThan(0);
    });

    it('should include color presets', () => {
      const red = store.getById('red');

      expect(red).toBeDefined();
      expect(red?.type).toBe('color');
      expect(red?.attributes.color).toEqual({ r: 1, g: 0, b: 0 });
    });
  });

  describe('create', () => {
    it('should create valid color preset', () => {
      const preset = store.create({
        name: 'Purple',
        type: 'color',
        attributes: { color: { r: 0.5, g: 0, b: 1 } },
      });

      expect(preset.id).toBeDefined();
      expect(preset.name).toBe('Purple');
    });

    it('should create valid position preset', () => {
      const preset = store.create({
        name: 'Up Left',
        type: 'position',
        attributes: { pan: -0.5, tilt: 0.5 },
      });

      expect(preset.type).toBe('position');
    });

    it('should throw for color preset without color or intensity', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'color',
          attributes: { zoom: 0.5 },
        });
      }).toThrow(ValidationError);
    });

    it('should throw for position preset without pan or tilt', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'position',
          attributes: { intensity: 1 },
        });
      }).toThrow(ValidationError);
    });

    it('should throw for beam preset without zoom', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'beam',
          attributes: { intensity: 1 },
        });
      }).toThrow(ValidationError);
    });

    it('should throw for out-of-range intensity', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'full',
          attributes: { intensity: 1.5 },
        });
      }).toThrow(ValidationError);

      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'full',
          attributes: { intensity: -0.1 },
        });
      }).toThrow(ValidationError);
    });

    it('should throw for out-of-range color values', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'color',
          attributes: { color: { r: 1.5, g: 0, b: 0 } },
        });
      }).toThrow(ValidationError);
    });

    it('should throw for out-of-range pan/tilt', () => {
      expect(() => {
        store.create({
          name: 'Invalid',
          type: 'position',
          attributes: { pan: 1.5 },
        });
      }).toThrow(ValidationError);
    });
  });

  describe('getByType', () => {
    it('should filter presets by type', () => {
      const colorPresets = store.getByType('color');
      const positionPresets = store.getByType('position');

      expect(colorPresets.length).toBeGreaterThan(0);
      colorPresets.forEach((p) => {
        expect(p.type).toBe('color');
      });

      expect(positionPresets.length).toBeGreaterThan(0);
      positionPresets.forEach((p) => {
        expect(p.type).toBe('position');
      });
    });
  });
});
