import { BinaryReader } from './reader.js';
import type { MADataHeader, MAVersion } from './types.js';

const MA_DATA_MAGIC = 'MA DATA\0';
const MAGIC_LENGTH = 8;

/**
 * Parse the MA DATA file header
 *
 * Header structure (observed):
 * - Bytes 0-7: "MA DATA\0" magic string
 * - Bytes 8-12: Version bytes (e.g., 41 3C 09 03 02)
 * - Following: Size fields, timestamps, etc.
 */
export function parseHeader(buffer: Buffer): MADataHeader | null {
  if (buffer.length < 16) {
    return null;
  }

  const reader = new BinaryReader(buffer);

  // Verify magic bytes
  const magic = reader.readFixedString(MAGIC_LENGTH);
  if (magic !== MA_DATA_MAGIC) {
    return null;
  }

  // Version bytes (observed: 41 3C 09 03 02)
  // The format appears to be: [unknown] [minor_low] [minor_high] [major] [unknown]
  // For version 3.9.x: 09 = 9, 03 = 3
  const versionBytes = reader.readBytes(5);
  const version: MAVersion = {
    major: versionBytes[3],
    minor: versionBytes[2],
    patch: versionBytes[1],
    raw: versionBytes,
  };

  // Skip 3 bytes of padding/unknown data
  reader.skip(3);

  // First size field (appears to be total data size or similar)
  const dataSize = reader.readUInt32LE();

  // Skip 4 bytes
  reader.skip(4);

  // Timestamp (Unix timestamp, observed as 0x54EC51D0 etc.)
  const timestamp = reader.readUInt32LE();

  return {
    magic,
    version,
    headerSize: reader.position,
    timestamp,
  };
}

/**
 * Validate that a buffer contains valid MA DATA
 */
export function isValidMAData(buffer: Buffer): boolean {
  if (buffer.length < MAGIC_LENGTH) {
    return false;
  }
  const magic = buffer.toString('utf8', 0, MAGIC_LENGTH);
  return magic === MA_DATA_MAGIC;
}

/**
 * Format version for display
 */
export function formatVersion(version: MAVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Format timestamp as ISO date string
 */
export function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) {
    return 'Unknown';
  }
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Get raw version bytes as hex string (for debugging)
 */
export function versionBytesHex(version: MAVersion): string {
  return version.raw.toString('hex').match(/.{2}/g)?.join(' ') ?? '';
}
