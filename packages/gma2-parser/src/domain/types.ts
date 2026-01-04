/**
 * Domain types for extracted GMA2 data
 */

/**
 * Extracted fixture record
 */
export interface ExtractedFixture {
  /** Offset in binary file where record was found */
  offset: number;
  /** Fixture name as shown in GrandMA2 */
  name: string;
  /** DMX universe (0-based) */
  universe: number;
  /** DMX start channel (1-512) */
  startChannel: number;
  /** Reference to fixture type */
  fixtureTypeId: number;
  /** Fixture type name if resolved */
  fixtureTypeName?: string;
  /** Number of DMX channels */
  channelCount?: number;
  /** Raw attribute values (for debugging) */
  rawAttributes?: number[];
}

/**
 * Extracted fixture type/model
 */
export interface ExtractedFixtureType {
  /** Internal ID in show file */
  id: number;
  /** Manufacturer name */
  manufacturer: string;
  /** Model name */
  model: string;
  /** DMX mode name */
  modeName?: string;
  /** Number of channels in this mode */
  channelCount: number;
  /** Channel names/functions */
  channels?: string[];
}

/**
 * Extracted group
 */
export interface ExtractedGroup {
  offset: number;
  name: string;
  fixtureIds: number[];
  /** GrandMA2 group ID (if found) */
  groupId?: number;
  /** Group type: slot (empty), system, user, all */
  groupType?: string;
}

/**
 * Extracted preset
 */
export interface ExtractedPreset {
  offset: number;
  name: string;
  type: 'color' | 'position' | 'gobo' | 'beam' | 'all';
  /** Normalized attribute values (0-1) */
  attributes: Record<string, number>;
}

/**
 * Complete extracted show data
 */
export interface ExtractedShow {
  name: string;
  offset: number;
  fixtures: ExtractedFixture[];
  fixtureTypes: ExtractedFixtureType[];
  groups: ExtractedGroup[];
  presets: ExtractedPreset[];
}
