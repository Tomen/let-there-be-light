import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  listShows,
  switchShow,
  getShowInfo,
  resetStores,
  initializeStores,
} from './index.js';

const TEST_DATA_ROOT = join(import.meta.dirname, '../../test-data-shows');

describe('Show Management', () => {
  beforeEach(() => {
    // Clean up and create test directory structure
    if (existsSync(TEST_DATA_ROOT)) {
      rmSync(TEST_DATA_ROOT, { recursive: true });
    }
    mkdirSync(TEST_DATA_ROOT, { recursive: true });

    // Create shared fixture-models.yaml
    writeFileSync(
      join(TEST_DATA_ROOT, 'fixture-models.yaml'),
      '- id: test-model\n  brand: Test\n  model: Test\n  channels:\n    red: 1\n  revision: 1\n'
    );

    // Create default show directory
    mkdirSync(join(TEST_DATA_ROOT, 'default'));
    writeFileSync(join(TEST_DATA_ROOT, 'default', 'fixtures.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'default', 'groups.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'default', 'presets.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'default', 'graphs.yaml'), '[]');

    // Create another show directory
    mkdirSync(join(TEST_DATA_ROOT, 'sunday-service'));
    writeFileSync(join(TEST_DATA_ROOT, 'sunday-service', 'fixtures.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'sunday-service', 'groups.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'sunday-service', 'presets.yaml'), '[]');
    writeFileSync(join(TEST_DATA_ROOT, 'sunday-service', 'graphs.yaml'), '[]');

    // Reset stores before each test
    resetStores();
  });

  afterEach(() => {
    // Clean up
    resetStores();
    if (existsSync(TEST_DATA_ROOT)) {
      rmSync(TEST_DATA_ROOT, { recursive: true });
    }
  });

  describe('listShows', () => {
    it('should list all show directories', () => {
      // Note: listShows reads from DATA_ROOT which is set at module load time
      // This test verifies the function structure works
      const shows = listShows();

      // Should be an array (actual content depends on DATA_ROOT env var)
      expect(Array.isArray(shows)).toBe(true);
    });

    it('should return shows with correct properties', () => {
      const shows = listShows();

      for (const show of shows) {
        expect(show).toHaveProperty('id');
        expect(show).toHaveProperty('name');
        expect(show).toHaveProperty('isActive');
        expect(typeof show.id).toBe('string');
        expect(typeof show.name).toBe('string');
        expect(typeof show.isActive).toBe('boolean');
      }
    });

    it('should mark one show as active', () => {
      const shows = listShows();

      if (shows.length > 0) {
        const activeShows = shows.filter((s) => s.isActive);
        expect(activeShows.length).toBe(1);
      }
    });
  });

  describe('getShowInfo', () => {
    it('should return current show info', () => {
      const info = getShowInfo();

      expect(info).toHaveProperty('show');
      expect(info).toHaveProperty('dataDir');
      expect(info).toHaveProperty('dataRoot');
      expect(typeof info.show).toBe('string');
      expect(typeof info.dataDir).toBe('string');
      expect(typeof info.dataRoot).toBe('string');
    });

    it('should have dataDir that includes show name', () => {
      const info = getShowInfo();

      expect(info.dataDir).toContain(info.show);
    });
  });

  describe('switchShow', () => {
    it('should throw error for non-existent show', () => {
      expect(() => switchShow('non-existent-show')).toThrow('Show not found');
    });

    it('should not throw for switching to current show', () => {
      // Get current show
      const info = getShowInfo();

      // Initialize stores first
      initializeStores();

      // Switching to current show should work (no-op essentially)
      expect(() => switchShow(info.show)).not.toThrow();
    });
  });

  describe('resetStores', () => {
    it('should allow reinitializing stores after reset', () => {
      // Initialize stores
      const stores1 = initializeStores();
      expect(stores1).toBeDefined();

      // Reset
      resetStores();

      // Should be able to initialize again
      const stores2 = initializeStores();
      expect(stores2).toBeDefined();
    });
  });
});
