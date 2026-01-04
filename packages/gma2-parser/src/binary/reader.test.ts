import { describe, it, expect } from 'vitest';
import { BinaryReader } from './reader.js';

describe('BinaryReader', () => {
  describe('position management', () => {
    it('should start at position 0 by default', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(reader.position).toBe(0);
    });

    it('should start at specified offset', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer, 2);
      expect(reader.position).toBe(2);
    });

    it('should seek to absolute position', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      reader.seek(2);
      expect(reader.position).toBe(2);
    });

    it('should throw on invalid seek', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(() => reader.seek(-1)).toThrow(RangeError);
      expect(() => reader.seek(5)).toThrow(RangeError);
    });

    it('should skip bytes', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      reader.skip(2);
      expect(reader.position).toBe(2);
    });

    it('should report remaining bytes', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(reader.remaining()).toBe(4);
      reader.skip(2);
      expect(reader.remaining()).toBe(2);
    });

    it('should report hasMore correctly', () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const reader = new BinaryReader(buffer);
      expect(reader.hasMore()).toBe(true);
      reader.skip(2);
      expect(reader.hasMore()).toBe(false);
    });
  });

  describe('integer reading', () => {
    it('should read unsigned 8-bit integer', () => {
      const buffer = Buffer.from([0xff, 0x00]);
      const reader = new BinaryReader(buffer);
      expect(reader.readUInt8()).toBe(255);
      expect(reader.readUInt8()).toBe(0);
    });

    it('should read signed 8-bit integer', () => {
      const buffer = Buffer.from([0xff, 0x7f]);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt8()).toBe(-1);
      expect(reader.readInt8()).toBe(127);
    });

    it('should read little-endian uint16', () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const reader = new BinaryReader(buffer);
      expect(reader.readUInt16LE()).toBe(0x0201);
    });

    it('should read big-endian uint16', () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const reader = new BinaryReader(buffer);
      expect(reader.readUInt16BE()).toBe(0x0102);
    });

    it('should read little-endian uint32', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(reader.readUInt32LE()).toBe(0x04030201);
    });

    it('should read big-endian uint32', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(reader.readUInt32BE()).toBe(0x01020304);
    });

    it('should read signed int32 little-endian', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeInt32LE(-12345, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readInt32LE()).toBe(-12345);
    });

    it('should advance position after reading integers', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      const reader = new BinaryReader(buffer);
      reader.readUInt8();
      expect(reader.position).toBe(1);
      reader.readUInt16LE();
      expect(reader.position).toBe(3);
      reader.readUInt32LE();
      expect(reader.position).toBe(7);
    });

    it('should throw when reading past buffer end', () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const reader = new BinaryReader(buffer);
      expect(() => reader.readUInt32LE()).toThrow(RangeError);
    });
  });

  describe('float reading', () => {
    it('should read float little-endian', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeFloatLE(3.14, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readFloatLE()).toBeCloseTo(3.14, 5);
    });

    it('should read double little-endian', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeDoubleLE(3.14159265359, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readDoubleLE()).toBeCloseTo(3.14159265359, 10);
    });
  });

  describe('string reading', () => {
    it('should read null-terminated string', () => {
      const buffer = Buffer.from('Hello\0World\0');
      const reader = new BinaryReader(buffer);
      expect(reader.readNullTerminatedString()).toBe('Hello');
      expect(reader.readNullTerminatedString()).toBe('World');
    });

    it('should handle empty null-terminated string', () => {
      const buffer = Buffer.from('\0');
      const reader = new BinaryReader(buffer);
      expect(reader.readNullTerminatedString()).toBe('');
    });

    it('should throw if null terminator not found', () => {
      const buffer = Buffer.from('NoNull');
      const reader = new BinaryReader(buffer);
      expect(() => reader.readNullTerminatedString(10)).toThrow();
    });

    it('should read fixed-length string', () => {
      const buffer = Buffer.from('Hello World');
      const reader = new BinaryReader(buffer);
      expect(reader.readFixedString(5)).toBe('Hello');
      expect(reader.position).toBe(5);
    });

    it('should read length-prefixed string', () => {
      const buffer = Buffer.alloc(9);
      buffer.writeUInt32LE(5, 0);
      buffer.write('Hello', 4);
      const reader = new BinaryReader(buffer);
      expect(reader.readLengthPrefixedString()).toBe('Hello');
    });

    it('should handle empty length-prefixed string', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(0, 0);
      const reader = new BinaryReader(buffer);
      expect(reader.readLengthPrefixedString()).toBe('');
    });
  });

  describe('buffer operations', () => {
    it('should read bytes into new buffer', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      const bytes = reader.readBytes(2);
      expect(bytes).toEqual(Buffer.from([0x01, 0x02]));
      expect(reader.position).toBe(2);
    });

    it('should peek bytes without advancing', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      const bytes = reader.peekBytes(2);
      expect(bytes).toEqual(Buffer.from([0x01, 0x02]));
      expect(reader.position).toBe(0);
    });

    it('should peek single byte', () => {
      const buffer = Buffer.from([0xab, 0xcd]);
      const reader = new BinaryReader(buffer);
      expect(reader.peekUInt8()).toBe(0xab);
      expect(reader.position).toBe(0);
    });

    it('should peek uint32', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const reader = new BinaryReader(buffer);
      expect(reader.peekUInt32LE()).toBe(0x04030201);
      expect(reader.position).toBe(0);
    });
  });

  describe('debugging helpers', () => {
    it('should convert to hex string', () => {
      const buffer = Buffer.from([0xab, 0xcd, 0xef]);
      const reader = new BinaryReader(buffer);
      expect(reader.toHex(3)).toBe('ab cd ef');
    });

    it('should convert to ASCII with dots for non-printable', () => {
      const buffer = Buffer.from([0x48, 0x69, 0x00, 0x7f]);
      const reader = new BinaryReader(buffer);
      expect(reader.toAscii(4)).toBe('Hi..');
    });
  });

  describe('sub-reader', () => {
    it('should create sub-reader for section', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const reader = new BinaryReader(buffer);
      reader.skip(1);
      const sub = reader.subReader(2);
      expect(sub.length).toBe(2);
      expect(sub.readUInt8()).toBe(0x02);
      expect(reader.position).toBe(3);
    });
  });
});
