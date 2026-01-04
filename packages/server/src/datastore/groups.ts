import { join } from 'node:path';
import type { Group } from '@let-there-be-light/shared';
import { YamlDataStore, ValidationError } from './base.js';
import type { FixtureStore } from './fixtures.js';

// Default groups
const DEFAULT_GROUPS: Group[] = [
  { id: 'front', name: 'Front', fixtureIds: ['front-left', 'front-right'], revision: 1 },
  { id: 'back', name: 'Back', fixtureIds: ['back-left', 'back-right'], revision: 1 },
  { id: 'all-wash', name: 'All Wash', fixtureIds: ['front-left', 'front-right', 'back-left', 'back-right'], revision: 1 },
];

export class GroupStore extends YamlDataStore<Group> {
  constructor(
    dataDir: string,
    private fixtureStore: FixtureStore,
  ) {
    super(join(dataDir, 'groups.yaml'), 'Group');
  }

  /**
   * Initialize with default data if empty
   */
  initialize(): void {
    this.seed(DEFAULT_GROUPS);
  }

  /**
   * Create group with validation
   */
  override create(data: Omit<Group, 'id' | 'revision'>, id?: string): Group {
    this.validateFixtureIds(data.fixtureIds);
    return super.create(data, id);
  }

  /**
   * Update group with validation
   */
  override update(id: string, data: Partial<Omit<Group, 'id' | 'revision'>>, expectedRevision: number): Group {
    if (data.fixtureIds) {
      this.validateFixtureIds(data.fixtureIds);
    }
    return super.update(id, data, expectedRevision);
  }

  /**
   * Validate that all fixture IDs exist
   */
  private validateFixtureIds(fixtureIds: string[]): void {
    for (const fixtureId of fixtureIds) {
      if (!this.fixtureStore.exists(fixtureId)) {
        throw new ValidationError(`Fixture not found: ${fixtureId}`);
      }
    }
  }

  /**
   * Get groups containing a specific fixture
   */
  getByFixture(fixtureId: string): Group[] {
    return this.find((g) => g.fixtureIds.includes(fixtureId));
  }

  /**
   * Remove a fixture from all groups (called when fixture is deleted)
   */
  removeFixtureFromAll(fixtureId: string): void {
    const groups = this.getByFixture(fixtureId);
    for (const group of groups) {
      const updatedFixtureIds = group.fixtureIds.filter((id) => id !== fixtureId);
      // Use internal update to bypass validation (fixture is being deleted)
      super.update(group.id, { fixtureIds: updatedFixtureIds }, group.revision);
    }
  }
}

// Singleton instance
let instance: GroupStore | null = null;

export function getGroupStore(dataDir: string, fixtureStore: FixtureStore): GroupStore {
  if (!instance) {
    instance = new GroupStore(dataDir, fixtureStore);
    instance.initialize();
  }
  return instance;
}

export function resetGroupStore(): void {
  instance = null;
}
