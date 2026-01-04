/**
 * Fixture Definitions and Color Mapping
 *
 * Loads fixture definitions from fixtures.yaml and provides
 * utilities for applying colors to fixtures and groups.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

// ============================================================================
// Type Definitions
// ============================================================================

/** Channel mapping for a fixture model (channel name -> relative offset) */
export interface ChannelMap {
  dimmer?: number;
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  amber?: number;
  uv?: number;
  strobe?: number;
  mode?: number;
  [key: string]: number | undefined;
}

/** Fixture model definition (reusable template) */
export interface FixtureModel {
  brand: string;
  model: string;
  channels: ChannelMap;
}

/** Fixture definition from YAML */
export interface FixtureDefinition {
  name: string;
  model: string;
  universe: number;
  startChannel: number;
}

/** Resolved fixture with full channel information */
export interface Fixture {
  name: string;
  model: FixtureModel;
  modelName: string;
  universe: number;
  startChannel: number;
}

/** RGB color */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/** RGBW color */
export interface RGBWColor extends RGBColor {
  w?: number;
}

/** Channel values to set on a fixture */
export interface ChannelValues {
  universe: number;
  channels: Array<{ channel: number; value: number }>;
}

/** Raw YAML structure */
interface FixturesYaml {
  models: Record<string, FixtureModel>;
  fixtures: FixtureDefinition[];
  groups: Record<string, string[]>;
}

// ============================================================================
// Named Colors
// ============================================================================

export const NAMED_COLORS: Record<string, RGBWColor> = {
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  white: { r: 255, g: 255, b: 255, w: 255 },
  warm: { r: 255, g: 200, b: 150, w: 200 },
  cool: { r: 200, g: 220, b: 255, w: 128 },
  yellow: { r: 255, g: 255, b: 0 },
  cyan: { r: 0, g: 255, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  purple: { r: 128, g: 0, b: 255 },
  orange: { r: 255, g: 128, b: 0 },
  pink: { r: 255, g: 105, b: 180 },
  amber: { r: 255, g: 191, b: 0 },
  off: { r: 0, g: 0, b: 0 },
};

// ============================================================================
// Fixture Store
// ============================================================================

export class FixtureStore {
  private models: Map<string, FixtureModel> = new Map();
  private fixtures: Map<string, Fixture> = new Map();
  private groups: Map<string, string[]> = new Map();
  private loaded = false;

  constructor(private fixturesPath?: string) {
    if (!fixturesPath) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      this.fixturesPath = join(__dirname, '..', 'fixtures.yaml');
    }
  }

  /**
   * Load fixtures from YAML file
   */
  load(): void {
    if (this.loaded) return;

    if (!existsSync(this.fixturesPath!)) {
      throw new Error(`Fixtures file not found: ${this.fixturesPath}`);
    }

    const fileContent = readFileSync(this.fixturesPath!, 'utf8');
    const data = yaml.load(fileContent) as FixturesYaml;

    // Load models
    if (data.models) {
      for (const [name, model] of Object.entries(data.models)) {
        this.models.set(name, model);
      }
    }

    // Load fixtures and resolve model references
    if (data.fixtures) {
      for (const def of data.fixtures) {
        const model = this.models.get(def.model);
        if (!model) {
          throw new Error(`Fixture "${def.name}" references unknown model "${def.model}"`);
        }

        const fixture: Fixture = {
          name: def.name,
          model,
          modelName: def.model,
          universe: def.universe,
          startChannel: def.startChannel,
        };

        this.fixtures.set(def.name, fixture);
      }
    }

    // Load groups
    if (data.groups) {
      for (const [name, fixtureNames] of Object.entries(data.groups)) {
        // Validate fixture names
        for (const fixtureName of fixtureNames) {
          if (!this.fixtures.has(fixtureName)) {
            throw new Error(`Group "${name}" references unknown fixture "${fixtureName}"`);
          }
        }
        this.groups.set(name, fixtureNames);
      }
    }

    this.loaded = true;
  }

  /**
   * Get a fixture by name
   */
  getFixture(name: string): Fixture | undefined {
    this.ensureLoaded();
    return this.fixtures.get(name);
  }

  /**
   * Get all fixtures
   */
  getAllFixtures(): Fixture[] {
    this.ensureLoaded();
    return Array.from(this.fixtures.values());
  }

  /**
   * Get fixtures in a group
   */
  getGroup(name: string): Fixture[] {
    this.ensureLoaded();
    const fixtureNames = this.groups.get(name);
    if (!fixtureNames) return [];

    return fixtureNames
      .map((n) => this.fixtures.get(n))
      .filter((f): f is Fixture => f !== undefined);
  }

  /**
   * Get all group names
   */
  getGroupNames(): string[] {
    this.ensureLoaded();
    return Array.from(this.groups.keys());
  }

  /**
   * Get all model names
   */
  getModelNames(): string[] {
    this.ensureLoaded();
    return Array.from(this.models.keys());
  }

  /**
   * Get a model by name
   */
  getModel(name: string): FixtureModel | undefined {
    this.ensureLoaded();
    return this.models.get(name);
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      this.load();
    }
  }
}

// ============================================================================
// Color Mapping
// ============================================================================

/**
 * Parse a color string to RGBWColor
 * Accepts: named colors ("red", "blue") or RGB values
 */
export function parseColor(colorInput: string | RGBWColor): RGBWColor | null {
  if (typeof colorInput !== 'string') {
    return colorInput;
  }

  const lower = colorInput.toLowerCase();
  if (NAMED_COLORS[lower]) {
    return NAMED_COLORS[lower];
  }

  return null;
}

/**
 * Map a color to DMX channel values for a fixture
 */
export function mapColorToChannels(fixture: Fixture, color: RGBWColor): ChannelValues {
  const channels: Array<{ channel: number; value: number }> = [];
  const { startChannel, model } = fixture;
  const channelMap = model.channels;

  // Set dimmer to full if the fixture has one
  if (channelMap.dimmer !== undefined) {
    channels.push({
      channel: startChannel + channelMap.dimmer - 1,
      value: 255,
    });
  }

  // Set RGB channels
  if (channelMap.red !== undefined) {
    channels.push({
      channel: startChannel + channelMap.red - 1,
      value: color.r,
    });
  }
  if (channelMap.green !== undefined) {
    channels.push({
      channel: startChannel + channelMap.green - 1,
      value: color.g,
    });
  }
  if (channelMap.blue !== undefined) {
    channels.push({
      channel: startChannel + channelMap.blue - 1,
      value: color.b,
    });
  }

  // Set white channel if available and specified
  if (channelMap.white !== undefined) {
    channels.push({
      channel: startChannel + channelMap.white - 1,
      value: color.w ?? 0,
    });
  }

  // Set amber channel (derive from color if not specified)
  if (channelMap.amber !== undefined) {
    // Amber approximation: when R is high and G is medium
    const amberValue =
      color.r > 200 && color.g > 100 && color.g < 200 ? Math.min(color.g, 255) : 0;
    channels.push({
      channel: startChannel + channelMap.amber - 1,
      value: amberValue,
    });
  }

  // Set UV channel to 0 (usually not used for general colors)
  if (channelMap.uv !== undefined) {
    channels.push({
      channel: startChannel + channelMap.uv - 1,
      value: 0,
    });
  }

  // Set strobe to 0 (no strobe)
  if (channelMap.strobe !== undefined) {
    channels.push({
      channel: startChannel + channelMap.strobe - 1,
      value: 0,
    });
  }

  // Set mode to 0 (usually manual/DMX mode)
  if (channelMap.mode !== undefined) {
    channels.push({
      channel: startChannel + channelMap.mode - 1,
      value: 0,
    });
  }

  return {
    universe: fixture.universe,
    channels,
  };
}

/**
 * Create channel values to turn off a fixture (all channels to 0)
 */
export function mapOffToChannels(fixture: Fixture): ChannelValues {
  const channels: Array<{ channel: number; value: number }> = [];
  const { startChannel, model } = fixture;

  // Set all known channels to 0
  for (const [, offset] of Object.entries(model.channels)) {
    if (offset !== undefined) {
      channels.push({
        channel: startChannel + offset - 1,
        value: 0,
      });
    }
  }

  return {
    universe: fixture.universe,
    channels,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let fixtureStore: FixtureStore | null = null;

export function getFixtureStore(): FixtureStore {
  if (!fixtureStore) {
    fixtureStore = new FixtureStore();
  }
  return fixtureStore;
}
