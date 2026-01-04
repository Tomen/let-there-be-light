import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test the conversion functions by extracting the logic
describe('Art-Net Bridge Conversion', () => {
  describe('toDmx', () => {
    const toDmx = (value: number): number => {
      return Math.round(Math.max(0, Math.min(1, value)) * 255);
    };

    it('converts 0 to 0', () => {
      expect(toDmx(0)).toBe(0);
    });

    it('converts 1 to 255', () => {
      expect(toDmx(1)).toBe(255);
    });

    it('converts 0.5 to 128', () => {
      expect(toDmx(0.5)).toBe(128);
    });

    it('clamps values below 0', () => {
      expect(toDmx(-0.5)).toBe(0);
    });

    it('clamps values above 1', () => {
      expect(toDmx(1.5)).toBe(255);
    });
  });

  describe('panTiltToDmx', () => {
    const panTiltToDmx = (value: number): number => {
      return Math.round(((Math.max(-1, Math.min(1, value)) + 1) / 2) * 255);
    };

    it('converts -1 to 0', () => {
      expect(panTiltToDmx(-1)).toBe(0);
    });

    it('converts 0 to 128', () => {
      expect(panTiltToDmx(0)).toBe(128);
    });

    it('converts 1 to 255', () => {
      expect(panTiltToDmx(1)).toBe(255);
    });

    it('clamps values below -1', () => {
      expect(panTiltToDmx(-2)).toBe(0);
    });

    it('clamps values above 1', () => {
      expect(panTiltToDmx(2)).toBe(255);
    });
  });

  describe('Art-Net packet structure', () => {
    const ARTNET_HEADER = Buffer.from([
      0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // "Art-Net\0"
    ]);
    const ARTNET_OPCODE_DMX = 0x5000;

    function createArtDmxPacket(universe: number, dmxData: Uint8Array, sequence: number): Buffer {
      const packet = Buffer.alloc(18 + 512);

      // Art-Net header
      ARTNET_HEADER.copy(packet, 0);

      // OpCode (little-endian)
      packet.writeUInt16LE(ARTNET_OPCODE_DMX, 8);

      // Protocol version (14)
      packet.writeUInt16BE(14, 10);

      // Sequence
      packet.writeUInt8(sequence, 12);

      // Physical port
      packet.writeUInt8(0, 13);

      // Universe (little-endian)
      packet.writeUInt16LE(universe, 14);

      // Length (big-endian)
      packet.writeUInt16BE(512, 16);

      // DMX data
      Buffer.from(dmxData).copy(packet, 18);

      return packet;
    }

    it('creates packet with correct header', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet.slice(0, 8).toString()).toBe('Art-Net\0');
    });

    it('sets OpCode to ArtDmx (0x5000)', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet.readUInt16LE(8)).toBe(0x5000);
    });

    it('sets protocol version to 14', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet.readUInt16BE(10)).toBe(14);
    });

    it('sets sequence number', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 42);

      expect(packet.readUInt8(12)).toBe(42);
    });

    it('sets universe', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(5, dmx, 1);

      expect(packet.readUInt16LE(14)).toBe(5);
    });

    it('sets data length to 512', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet.readUInt16BE(16)).toBe(512);
    });

    it('copies DMX data', () => {
      const dmx = new Uint8Array(512);
      dmx[0] = 255;
      dmx[1] = 128;
      dmx[511] = 64;

      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet[18]).toBe(255);
      expect(packet[19]).toBe(128);
      expect(packet[18 + 511]).toBe(64);
    });

    it('creates packet with correct total length', () => {
      const dmx = new Uint8Array(512);
      const packet = createArtDmxPacket(0, dmx, 1);

      expect(packet.length).toBe(18 + 512);
    });
  });
});
