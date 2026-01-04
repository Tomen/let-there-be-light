import { join } from 'node:path';
import type { Input } from '@let-there-be-light/shared';
import { YamlDataStore, ValidationError } from './base.js';

// Default inputs (matching current hardcoded IDs for backwards compatibility)
const DEFAULT_INPUTS: Input[] = [
  // Faders A-H
  { id: 'A', name: 'Fader A', type: 'fader', revision: 1 },
  { id: 'B', name: 'Fader B', type: 'fader', revision: 1 },
  { id: 'C', name: 'Fader C', type: 'fader', revision: 1 },
  { id: 'D', name: 'Fader D', type: 'fader', revision: 1 },
  { id: 'E', name: 'Fader E', type: 'fader', revision: 1 },
  { id: 'F', name: 'Fader F', type: 'fader', revision: 1 },
  { id: 'G', name: 'Fader G', type: 'fader', revision: 1 },
  { id: 'H', name: 'Fader H', type: 'fader', revision: 1 },

  // Buttons X, Y, Z, P
  { id: 'X', name: 'Button X', type: 'button', revision: 1 },
  { id: 'Y', name: 'Button Y', type: 'button', revision: 1 },
  { id: 'Z', name: 'Button Z', type: 'button', revision: 1 },
  { id: 'P', name: 'Button P', type: 'button', revision: 1 },
];

export class InputStore extends YamlDataStore<Input> {
  constructor(dataDir: string) {
    super(join(dataDir, 'inputs.yaml'), 'Input');
  }

  /**
   * Initialize with default data if empty
   */
  initialize(): void {
    this.seed(DEFAULT_INPUTS);
  }

  /**
   * Create input with validation
   */
  override create(data: Omit<Input, 'id' | 'revision'>, id?: string): Input {
    this.validateInput(data);
    return super.create(data, id);
  }

  /**
   * Update input with validation
   */
  override update(id: string, data: Partial<Omit<Input, 'id' | 'revision'>>, expectedRevision: number): Input {
    const existing = this.getByIdOrThrow(id);
    const merged = { ...existing, ...data };
    this.validateInput(merged);
    return super.update(id, data, expectedRevision);
  }

  /**
   * Validate input data
   */
  private validateInput(data: { type: Input['type']; name: string }): void {
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError('Input name is required');
    }
    if (!['fader', 'button'].includes(data.type)) {
      throw new ValidationError('Input type must be "fader" or "button"');
    }
  }

  /**
   * Get inputs by type
   */
  getByType(type: Input['type']): Input[] {
    return this.find((i) => i.type === type);
  }

  /**
   * Get all faders
   */
  getFaders(): Input[] {
    return this.getByType('fader');
  }

  /**
   * Get all buttons
   */
  getButtons(): Input[] {
    return this.getByType('button');
  }
}

// Singleton instance
let instance: InputStore | null = null;

export function getInputStore(dataDir: string): InputStore {
  if (!instance) {
    instance = new InputStore(dataDir);
    instance.initialize();
  }
  return instance;
}

export function resetInputStore(): void {
  instance = null;
}
