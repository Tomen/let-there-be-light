/**
 * Fixture extractor - parses fixture/patch data from GMA2 show files
 */
import { BinaryReader } from '../binary/reader.js';
import type { ExtractedFixture } from './types.js';

/**
 * Fixture record marker bytes (observed at -24 from name)
 */
export const FIXTURE_MARKER = Buffer.from([0x3e, 0xb9, 0x83, 0x58]);

/**
 * Known fixture offsets from FINDINGS.md (for testing)
 */
export const KNOWN_FIXTURE_OFFSETS = {
  'Moving 1': 0x00027215,
  'Moving 2': 0x0002c0ba,
  'Moving 3': 0x00030f4d,
  'Moving 4': 0x00035de0,
  Blinder: 0x0001cbce,
  Strobe: 0x0003f224,
  'Wash Stage 211': 0x00bd1728,
};

/**
 * Parse a fixture record at a known offset
 *
 * Structure (relative to name start):
 * -32: Header area
 * -24: Marker (3e b9 83 58)
 * -4:  Name length (32-bit LE)
 *  0:  Fixture name (null-terminated)
 * +N:  Fixture type ID (32-bit LE)
 * +N+4: Attribute data
 */
export function parseFixtureAtOffset(
  buffer: Buffer,
  nameOffset: number
): ExtractedFixture | null {
  const reader = new BinaryReader(buffer, nameOffset);

  if (reader.remaining() < 64) {
    return null;
  }

  // Read fixture name
  let name: string;
  try {
    name = reader.readNullTerminatedString(64);
    // Strip non-printable characters
    name = name.replace(/[\x00-\x1F\x7F]/g, '').trim();
  } catch {
    return null;
  }

  if (!name) {
    return null;
  }

  // After name: fixture type ID
  const fixtureTypeId = reader.readUInt32LE();

  // Read potential DMX-related values
  const val1 = reader.readUInt32LE(); // Often 0xf0 (240)
  const val2 = reader.readUInt32LE();

  // Read potential universe/address bytes
  // At +16 from name end based on pattern: 00 40 could be address
  const byte1 = reader.readUInt8();
  const byte2 = reader.readUInt8();

  // Try to interpret DMX address
  // In GrandMA2, address is typically stored as (universe * 512) + channel
  // Or could be separate universe and channel fields
  const potentialAddress = reader.readUInt16LE();

  // Read attribute values (ff 00 patterns)
  const rawAttributes: number[] = [];
  for (let i = 0; i < 16; i++) {
    rawAttributes.push(reader.readUInt8());
  }

  // Try to decode universe/channel
  // Pattern analysis suggests:
  // - High byte might be universe
  // - Low byte/word might be channel
  let universe = 0;
  let startChannel = 1;

  // Check header area for DMX info (look back from name)
  const headerReader = new BinaryReader(buffer, nameOffset - 32);
  const headerBytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    headerBytes.push(headerReader.readUInt8());
  }

  // Search header for DMX-like values (universe 0-15, channel 1-512)
  // Often stored as 16-bit values
  for (let i = 0; i < 28; i += 2) {
    const val = headerBytes[i] | (headerBytes[i + 1] << 8);
    // Likely channel value (1-512)
    if (val >= 1 && val <= 512) {
      startChannel = val;
      break;
    }
  }

  return {
    offset: nameOffset,
    name,
    universe,
    startChannel,
    fixtureTypeId,
    rawAttributes,
  };
}

/**
 * Scan buffer for fixture markers and extract fixtures
 */
export function scanForFixtures(
  buffer: Buffer,
  startOffset: number = 0,
  endOffset?: number
): ExtractedFixture[] {
  const end = endOffset ?? buffer.length;
  const fixtures: ExtractedFixture[] = [];

  // Scan for fixture marker pattern
  for (let i = startOffset; i < end - FIXTURE_MARKER.length - 28; i++) {
    // Check for marker
    let match = true;
    for (let j = 0; j < FIXTURE_MARKER.length; j++) {
      if (buffer[i + j] !== FIXTURE_MARKER[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Marker found, name should be at +28 from marker (+24 for header + 4 for length)
      const nameOffset = i + 28;

      // Verify it looks like a fixture name (starts with printable ASCII)
      if (nameOffset < end && buffer[nameOffset] >= 32 && buffer[nameOffset] < 127) {
        const fixture = parseFixtureAtOffset(buffer, nameOffset);
        if (fixture) {
          fixtures.push(fixture);
        }
      }
    }
  }

  return fixtures;
}

/**
 * Dump fixture record bytes for analysis
 */
export function dumpFixtureRecord(
  buffer: Buffer,
  nameOffset: number,
  contextBefore: number = 32,
  contextAfter: number = 64
): string {
  const lines: string[] = [];
  const start = Math.max(0, nameOffset - contextBefore);
  const end = Math.min(buffer.length, nameOffset + contextAfter);

  lines.push(`Fixture record at 0x${nameOffset.toString(16)}:`);
  lines.push('');

  for (let offset = start; offset < end; offset += 16) {
    const relOffset = offset - nameOffset;
    const hexParts: string[] = [];
    const asciiParts: string[] = [];

    for (let i = 0; i < 16 && offset + i < end; i++) {
      const byte = buffer[offset + i];
      hexParts.push(byte.toString(16).padStart(2, '0'));
      asciiParts.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }

    const relLabel = relOffset >= 0 ? `+${relOffset}` : `${relOffset}`;
    lines.push(
      `${relLabel.padStart(4)}  ${hexParts.join(' ').padEnd(47)}  ${asciiParts.join('')}`
    );
  }

  return lines.join('\n');
}

/**
 * Extract all fixtures using multiple strategies
 */
export function extractFixtures(buffer: Buffer): ExtractedFixture[] {
  const fixtures: ExtractedFixture[] = [];
  const seen = new Set<string>();

  // Strategy 1: Use known offsets
  for (const [name, offset] of Object.entries(KNOWN_FIXTURE_OFFSETS)) {
    if (offset < buffer.length) {
      const fixture = parseFixtureAtOffset(buffer, offset);
      if (fixture && !seen.has(fixture.name)) {
        seen.add(fixture.name);
        fixtures.push(fixture);
      }
    }
  }

  // Strategy 2: Scan for fixture markers
  const scanned = scanForFixtures(buffer);
  for (const fixture of scanned) {
    if (!seen.has(fixture.name)) {
      seen.add(fixture.name);
      fixtures.push(fixture);
    }
  }

  return fixtures;
}
