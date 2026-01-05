import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { Show } from '@let-there-be-light/shared';
import { FixtureStore, getFixtureStore, resetFixtureStore } from './fixtures.js';
import { GroupStore, getGroupStore, resetGroupStore } from './groups.js';
import { GraphStore, getGraphStore, resetGraphStore } from './graphs.js';
import { InputStore, getInputStore, resetInputStore } from './inputs.js';

export { YamlDataStore, NotFoundError, ConflictError, ValidationError } from './base.js';
export { FixtureStore, getFixtureStore, resetFixtureStore } from './fixtures.js';
export { GroupStore, getGroupStore, resetGroupStore } from './groups.js';
export { GraphStore, getGraphStore, resetGraphStore } from './graphs.js';
export { InputStore, getInputStore, resetInputStore } from './inputs.js';

// Get data root directory (shared across all shows)
function getDataRoot(): string {
  return process.env.DATA_DIR || join(import.meta.dirname, '../../../data');
}

// Data root (constant once computed)
const DATA_ROOT = getDataRoot();

// Shared fixture models path
const MODELS_PATH = join(DATA_ROOT, 'fixture-models.yaml');

// Track current show name (initially from env, can be changed at runtime)
let currentShow = process.env.SHOW || 'default';

// Get the current show directory
function getShowDir(): string {
  return join(DATA_ROOT, currentShow);
}

// Export for logging in server startup and API responses
export function getShowInfo(): { show: string; dataDir: string; dataRoot: string } {
  return { show: currentShow, dataDir: getShowDir(), dataRoot: DATA_ROOT };
}

// All stores
export interface DataStores {
  fixtures: FixtureStore;
  groups: GroupStore;
  graphs: GraphStore;
  inputs: InputStore;
}

// Singleton stores instance
let stores: DataStores | null = null;

/**
 * Initialize all data stores
 * @param showDir - Per-show data directory (fixtures, groups, graphs)
 * @param modelsPath - Shared fixture models path
 */
export function initializeStores(
  showDir: string = getShowDir(),
  modelsPath: string = MODELS_PATH
): DataStores {
  if (stores) {
    return stores;
  }

  const fixtures = getFixtureStore(showDir, modelsPath);
  const groups = getGroupStore(showDir, fixtures);
  const graphs = getGraphStore(showDir);
  const inputs = getInputStore(showDir);

  stores = { fixtures, groups, graphs, inputs };
  return stores;
}

/**
 * Get initialized stores (throws if not initialized)
 */
export function getStores(): DataStores {
  if (!stores) {
    throw new Error('Data stores not initialized. Call initializeStores() first.');
  }
  return stores;
}

/**
 * Reset all stores (for testing or show switching)
 */
export function resetStores(): void {
  // Reset individual store singletons
  resetFixtureStore();
  resetGroupStore();
  resetGraphStore();
  resetInputStore();
  // Clear the combined stores reference
  stores = null;
}

/**
 * List all available shows (subdirectories in data root)
 */
export function listShows(): Show[] {
  const shows: Show[] = [];

  if (!existsSync(DATA_ROOT)) {
    return shows;
  }

  const entries = readdirSync(DATA_ROOT);
  for (const entry of entries) {
    const fullPath = join(DATA_ROOT, entry);
    // Only include directories (not fixture-models.yaml)
    if (statSync(fullPath).isDirectory()) {
      shows.push({
        id: entry,
        name: entry, // Use directory name as display name
        isActive: entry === currentShow,
      });
    }
  }

  // Sort alphabetically, but put active show first
  shows.sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return a.name.localeCompare(b.name);
  });

  return shows;
}

/**
 * Switch to a different show
 * @param showName - The name of the show directory to switch to
 * @throws Error if show directory doesn't exist
 */
export function switchShow(showName: string): void {
  const showPath = join(DATA_ROOT, showName);

  // Validate show directory exists
  if (!existsSync(showPath) || !statSync(showPath).isDirectory()) {
    throw new Error(`Show not found: ${showName}`);
  }

  // Update current show
  currentShow = showName;

  // Reset all stores to force reinitialization with new paths
  resetStores();

  // Reinitialize stores with new show directory
  initializeStores(showPath, MODELS_PATH);

  console.log(`Switched to show: ${showName}`);
}
