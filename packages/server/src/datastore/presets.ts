import { join } from 'node:path';
import type { Preset } from '@let-there-be-light/shared';
import { YamlDataStore, ValidationError } from './base.js';

// Default presets
const DEFAULT_PRESETS: Preset[] = [
  // Color presets
  { id: 'red', name: 'Red', type: 'color', attributes: { color: { r: 1, g: 0, b: 0 } }, revision: 1 },
  { id: 'green', name: 'Green', type: 'color', attributes: { color: { r: 0, g: 1, b: 0 } }, revision: 1 },
  { id: 'blue', name: 'Blue', type: 'color', attributes: { color: { r: 0, g: 0, b: 1 } }, revision: 1 },
  { id: 'white', name: 'White', type: 'color', attributes: { color: { r: 1, g: 1, b: 1 } }, revision: 1 },
  { id: 'warm', name: 'Warm White', type: 'color', attributes: { color: { r: 1, g: 0.8, b: 0.6 } }, revision: 1 },
  { id: 'cool', name: 'Cool White', type: 'color', attributes: { color: { r: 0.8, g: 0.9, b: 1 } }, revision: 1 },
  { id: 'amber', name: 'Amber', type: 'color', attributes: { color: { r: 1, g: 0.6, b: 0 } }, revision: 1 },
  { id: 'cyan', name: 'Cyan', type: 'color', attributes: { color: { r: 0, g: 1, b: 1 } }, revision: 1 },
  { id: 'magenta', name: 'Magenta', type: 'color', attributes: { color: { r: 1, g: 0, b: 1 } }, revision: 1 },
  { id: 'yellow', name: 'Yellow', type: 'color', attributes: { color: { r: 1, g: 1, b: 0 } }, revision: 1 },

  // Position presets
  { id: 'center', name: 'Center', type: 'position', attributes: { pan: 0, tilt: 0 }, revision: 1 },
  { id: 'audience', name: 'Audience', type: 'position', attributes: { pan: 0, tilt: -0.5 }, revision: 1 },
  { id: 'stage-left', name: 'Stage Left', type: 'position', attributes: { pan: -0.5, tilt: 0 }, revision: 1 },
  { id: 'stage-right', name: 'Stage Right', type: 'position', attributes: { pan: 0.5, tilt: 0 }, revision: 1 },

  // Beam presets
  { id: 'wide', name: 'Wide', type: 'beam', attributes: { zoom: 1 }, revision: 1 },
  { id: 'narrow', name: 'Narrow', type: 'beam', attributes: { zoom: 0 }, revision: 1 },
  { id: 'medium', name: 'Medium', type: 'beam', attributes: { zoom: 0.5 }, revision: 1 },

  // Full presets
  { id: 'blackout', name: 'Blackout', type: 'full', attributes: { intensity: 0 }, revision: 1 },
  { id: 'full-on', name: 'Full On', type: 'full', attributes: { intensity: 1, color: { r: 1, g: 1, b: 1 } }, revision: 1 },
];

export class PresetStore extends YamlDataStore<Preset> {
  constructor(dataDir: string) {
    super(join(dataDir, 'presets.yaml'), 'Preset');
  }

  /**
   * Initialize with default data if empty
   */
  initialize(): void {
    this.seed(DEFAULT_PRESETS);
  }

  /**
   * Create preset with validation
   */
  override create(data: Omit<Preset, 'id' | 'revision'>, id?: string): Preset {
    this.validatePreset(data);
    return super.create(data, id);
  }

  /**
   * Update preset with validation
   */
  override update(id: string, data: Partial<Omit<Preset, 'id' | 'revision'>>, expectedRevision: number): Preset {
    // Get existing and merge for validation
    const existing = this.getByIdOrThrow(id);
    const merged = { ...existing, ...data };
    this.validatePreset(merged);
    return super.update(id, data, expectedRevision);
  }

  /**
   * Validate preset data
   */
  private validatePreset(data: { type: Preset['type']; attributes: Preset['attributes'] }): void {
    const { type, attributes } = data;

    // Validate attributes match type
    switch (type) {
      case 'color':
        if (!attributes.color && attributes.intensity === undefined) {
          throw new ValidationError('Color preset must have color or intensity');
        }
        break;
      case 'position':
        if (attributes.pan === undefined && attributes.tilt === undefined) {
          throw new ValidationError('Position preset must have pan or tilt');
        }
        break;
      case 'beam':
        if (attributes.zoom === undefined) {
          throw new ValidationError('Beam preset must have zoom');
        }
        break;
      case 'full':
        // Full presets can have any attributes
        break;
    }

    // Validate value ranges
    if (attributes.intensity !== undefined) {
      if (attributes.intensity < 0 || attributes.intensity > 1) {
        throw new ValidationError('Intensity must be between 0 and 1');
      }
    }
    if (attributes.color) {
      const { r, g, b } = attributes.color;
      if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
        throw new ValidationError('Color values must be between 0 and 1');
      }
    }
    if (attributes.pan !== undefined && (attributes.pan < -1 || attributes.pan > 1)) {
      throw new ValidationError('Pan must be between -1 and 1');
    }
    if (attributes.tilt !== undefined && (attributes.tilt < -1 || attributes.tilt > 1)) {
      throw new ValidationError('Tilt must be between -1 and 1');
    }
    if (attributes.zoom !== undefined && (attributes.zoom < 0 || attributes.zoom > 1)) {
      throw new ValidationError('Zoom must be between 0 and 1');
    }
  }

  /**
   * Get presets by type
   */
  getByType(type: Preset['type']): Preset[] {
    return this.find((p) => p.type === type);
  }
}

// Singleton instance
let instance: PresetStore | null = null;

export function getPresetStore(dataDir: string): PresetStore {
  if (!instance) {
    instance = new PresetStore(dataDir);
    instance.initialize();
  }
  return instance;
}

export function resetPresetStore(): void {
  instance = null;
}
