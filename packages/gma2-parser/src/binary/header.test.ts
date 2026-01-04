import { describe, it, expect } from 'vitest';
import {
  parseHeader,
  isValidMAData,
  formatVersion,
  formatTimestamp,
  versionBytesHex,
} from './header.js';
import type { MAVersion } from './types.js';

describe('header parser', () => {
  describe('parseHeader', () => {
    it('should parse valid MA DATA header', () => {
      // Create a buffer with MA DATA header
      const buffer = Buffer.alloc(32);
      buffer.write('MA DATA\0', 0);
      // Version bytes: 41 3C 09 03 02 (version 3.9.x)
      buffer[8] = 0x41;
      buffer[9] = 0x3c;
      buffer[10] = 0x09;
      buffer[11] = 0x03;
      buffer[12] = 0x02;
      // Padding
      buffer[13] = 0x00;
      buffer[14] = 0x00;
      buffer[15] = 0x00;
      // Data size
      buffer.writeUInt32LE(0x24b4, 16);
      // Padding
      buffer.writeUInt32LE(0, 20);
      // Timestamp
      buffer.writeUInt32LE(0x54ec51d0, 24);

      const header = parseHeader(buffer);

      expect(header).not.toBeNull();
      expect(header?.magic).toBe('MA DATA\0');
      expect(header?.version.major).toBe(3);
      expect(header?.version.minor).toBe(9);
      expect(header?.timestamp).toBe(0x54ec51d0);
    });

    it('should return null for invalid magic', () => {
      const buffer = Buffer.from('Not MA DATA file content');
      expect(parseHeader(buffer)).toBeNull();
    });

    it('should return null for too-short buffer', () => {
      const buffer = Buffer.from('MA DATA');
      expect(parseHeader(buffer)).toBeNull();
    });
  });

  describe('isValidMAData', () => {
    it('should return true for valid MA DATA', () => {
      const buffer = Buffer.alloc(16);
      buffer.write('MA DATA\0', 0);
      expect(isValidMAData(buffer)).toBe(true);
    });

    it('should return false for invalid data', () => {
      const buffer = Buffer.from('Invalid data');
      expect(isValidMAData(buffer)).toBe(false);
    });

    it('should return false for too-short buffer', () => {
      const buffer = Buffer.from('MA');
      expect(isValidMAData(buffer)).toBe(false);
    });
  });

  describe('formatVersion', () => {
    it('should format version as string', () => {
      const version: MAVersion = {
        major: 3,
        minor: 9,
        patch: 60,
        raw: Buffer.alloc(5),
      };
      expect(formatVersion(version)).toBe('3.9.60');
    });
  });

  describe('formatTimestamp', () => {
    it('should format Unix timestamp as ISO string', () => {
      // 0x54EC51D0 = 1424779600 = Feb 2015
      const result = formatTimestamp(0x54ec51d0);
      expect(result).toMatch(/2015-02-2/); // Allow for timezone differences
    });

    it('should return Unknown for zero timestamp', () => {
      expect(formatTimestamp(0)).toBe('Unknown');
    });
  });

  describe('versionBytesHex', () => {
    it('should format version bytes as hex', () => {
      const version: MAVersion = {
        major: 3,
        minor: 9,
        patch: 60,
        raw: Buffer.from([0x41, 0x3c, 0x09, 0x03, 0x02]),
      };
      expect(versionBytesHex(version)).toBe('41 3c 09 03 02');
    });
  });
});
