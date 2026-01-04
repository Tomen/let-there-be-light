import { join } from 'node:path';
import type { Fixture, FixtureModel } from '@let-there-be-light/shared';
import { YamlDataStore, ValidationError } from './base.js';

// Fixture models are stored separately (they don't have revision)
interface StoredFixtureModel extends FixtureModel {
  id: string;
  revision: number;
}

// Default fixture models
const DEFAULT_MODELS: StoredFixtureModel[] = [
  {
    id: 'generic-rgbw',
    brand: 'Generic',
    model: 'RGBW Par',
    channels: { red: 1, green: 2, blue: 3, white: 4 },
    revision: 1,
  },
  {
    id: 'generic-rgb',
    brand: 'Generic',
    model: 'RGB Par',
    channels: { red: 1, green: 2, blue: 3 },
    revision: 1,
  },
  {
    id: 'generic-dimmer',
    brand: 'Generic',
    model: 'Dimmer',
    channels: { dimmer: 1 },
    revision: 1,
  },
  {
    id: 'moving-head-spot',
    brand: 'Generic',
    model: 'Moving Head Spot',
    channels: {
      pan: 1,
      panFine: 2,
      tilt: 3,
      tiltFine: 4,
      dimmer: 5,
      shutter: 6,
      red: 7,
      green: 8,
      blue: 9,
      white: 10,
      zoom: 11,
    },
    revision: 1,
  },
];

// Default fixtures
const DEFAULT_FIXTURES: Fixture[] = [
  { id: 'front-left', name: 'Front Left', modelId: 'generic-rgbw', universe: 0, startChannel: 1, revision: 1 },
  { id: 'front-right', name: 'Front Right', modelId: 'generic-rgbw', universe: 0, startChannel: 5, revision: 1 },
  { id: 'back-left', name: 'Back Left', modelId: 'generic-rgbw', universe: 0, startChannel: 9, revision: 1 },
  { id: 'back-right', name: 'Back Right', modelId: 'generic-rgbw', universe: 0, startChannel: 13, revision: 1 },
];

export class FixtureStore extends YamlDataStore<Fixture> {
  private modelStore: YamlDataStore<StoredFixtureModel>;

  constructor(dataDir: string, modelsPath?: string) {
    super(join(dataDir, 'fixtures.yaml'), 'Fixture');
    // Models can be at a separate path (shared across shows) or in the show directory
    const modelsFile = modelsPath || join(dataDir, 'fixture-models.yaml');
    this.modelStore = new YamlDataStore<StoredFixtureModel>(
      modelsFile,
      'FixtureModel'
    );
  }

  /**
   * Initialize with default data if empty
   */
  initialize(): void {
    this.modelStore.seed(DEFAULT_MODELS);
    this.seed(DEFAULT_FIXTURES);
  }

  /**
   * Get all fixture models
   */
  getModels(): FixtureModel[] {
    return this.modelStore.getAll();
  }

  /**
   * Get a fixture model by ID
   */
  getModel(id: string): FixtureModel | null {
    return this.modelStore.getById(id);
  }

  /**
   * Create fixture with validation
   */
  override create(data: Omit<Fixture, 'id' | 'revision'>, id?: string): Fixture {
    // Validate model exists
    if (!this.modelStore.exists(data.modelId)) {
      throw new ValidationError(`Fixture model not found: ${data.modelId}`);
    }

    // Validate universe and channel
    if (data.universe < 0) {
      throw new ValidationError('Universe must be >= 0');
    }
    if (data.startChannel < 1 || data.startChannel > 512) {
      throw new ValidationError('Start channel must be between 1 and 512');
    }

    return super.create(data, id);
  }

  /**
   * Get fixtures by universe
   */
  getByUniverse(universe: number): Fixture[] {
    return this.find((f) => f.universe === universe);
  }

  /**
   * Get fixtures by model
   */
  getByModel(modelId: string): Fixture[] {
    return this.find((f) => f.modelId === modelId);
  }
}

// Singleton instance
let instance: FixtureStore | null = null;

export function getFixtureStore(dataDir: string, modelsPath?: string): FixtureStore {
  if (!instance) {
    instance = new FixtureStore(dataDir, modelsPath);
    instance.initialize();
  }
  return instance;
}

export function resetFixtureStore(): void {
  instance = null;
}
