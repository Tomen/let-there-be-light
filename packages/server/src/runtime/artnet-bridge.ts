/**
 * Art-Net Bridge
 *
 * Connects the runtime engine's frame output to Art-Net DMX output.
 * Converts AttributeBundle values to DMX channel values based on fixture models.
 */

import type { AttributeBundle, FixtureModel } from '@let-there-be-light/shared';
import type { FrameOutput } from './engine.js';
import { getStores } from '../datastore/index.js';

// DMX buffer per universe (512 channels each)
const dmxBuffers = new Map<number, Uint8Array>();

// Sequence counters per universe (1-255, wraps)
const sequenceCounters = new Map<number, number>();

// UDP socket for Art-Net output
let socket: ReturnType<typeof import('node:dgram').createSocket> | null = null;

// Art-Net configuration
const ARTNET_PORT = 6454;
const ARTNET_HEADER = Buffer.from([
  0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // "Art-Net\0"
]);
const ARTNET_OPCODE_DMX = 0x5000;

/**
 * Get or create DMX buffer for a universe
 */
function getDmxBuffer(universe: number): Uint8Array {
  if (!dmxBuffers.has(universe)) {
    dmxBuffers.set(universe, new Uint8Array(512));
  }
  return dmxBuffers.get(universe)!;
}

/**
 * Get next sequence number for a universe
 */
function getNextSequence(universe: number): number {
  const current = sequenceCounters.get(universe) || 1;
  const next = current >= 255 ? 1 : current + 1;
  sequenceCounters.set(universe, next);
  return current;
}

/**
 * Create ArtDmx packet
 */
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

/**
 * Convert normalized value (0-1) to DMX value (0-255)
 */
function toDmx(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

/**
 * Convert pan/tilt value (-1 to 1) to DMX value (0-255)
 * -1 = 0, 0 = 127, 1 = 255
 */
function panTiltToDmx(value: number): number {
  return Math.round(((Math.max(-1, Math.min(1, value)) + 1) / 2) * 255);
}

/**
 * Apply AttributeBundle to DMX buffer for a fixture
 */
function applyAttributesToDmx(
  dmxBuffer: Uint8Array,
  startChannel: number,
  model: FixtureModel,
  attrs: Partial<AttributeBundle>
): void {
  const channels = model.channels as Record<string, number>;

  // Intensity/Dimmer
  if (attrs.intensity !== undefined && channels.dimmer !== undefined) {
    dmxBuffer[startChannel + channels.dimmer - 2] = toDmx(attrs.intensity);
  }

  // Color (RGB)
  if (attrs.color !== undefined) {
    if (channels.red !== undefined) {
      dmxBuffer[startChannel + channels.red - 2] = toDmx(attrs.color.r);
    }
    if (channels.green !== undefined) {
      dmxBuffer[startChannel + channels.green - 2] = toDmx(attrs.color.g);
    }
    if (channels.blue !== undefined) {
      dmxBuffer[startChannel + channels.blue - 2] = toDmx(attrs.color.b);
    }
    // White channel - derive from color brightness if not specified separately
    if (channels.white !== undefined) {
      // Simple white derivation: average of RGB when all are high
      const minRGB = Math.min(attrs.color.r, attrs.color.g, attrs.color.b);
      dmxBuffer[startChannel + channels.white - 2] = toDmx(minRGB);
    }
  }

  // Pan/Tilt
  if (attrs.pan !== undefined && channels.pan !== undefined) {
    dmxBuffer[startChannel + channels.pan - 2] = panTiltToDmx(attrs.pan);
    // Fine pan if available
    if (channels.panFine !== undefined) {
      dmxBuffer[startChannel + channels.panFine - 2] = 0;
    }
  }
  if (attrs.tilt !== undefined && channels.tilt !== undefined) {
    dmxBuffer[startChannel + channels.tilt - 2] = panTiltToDmx(attrs.tilt);
    // Fine tilt if available
    if (channels.tiltFine !== undefined) {
      dmxBuffer[startChannel + channels.tiltFine - 2] = 0;
    }
  }

  // Zoom
  if (attrs.zoom !== undefined && channels.zoom !== undefined) {
    dmxBuffer[startChannel + channels.zoom - 2] = toDmx(attrs.zoom);
  }
}

/**
 * Initialize the Art-Net bridge
 */
export async function initializeArtNetBridge(broadcastAddress = '2.255.255.255'): Promise<void> {
  if (socket) return;

  const dgram = await import('node:dgram');
  socket = dgram.createSocket('udp4');

  return new Promise((resolve, reject) => {
    socket!.on('error', (err) => {
      console.error('Art-Net socket error:', err);
      reject(err);
    });

    socket!.bind(() => {
      socket!.setBroadcast(true);
      console.log(`Art-Net bridge initialized, broadcasting to ${broadcastAddress}:${ARTNET_PORT}`);
      resolve();
    });
  });
}

/**
 * Process a frame and output to Art-Net
 */
export function processFrame(frame: FrameOutput, broadcastAddress = '2.255.255.255'): void {
  if (!socket) {
    console.warn('Art-Net bridge not initialized');
    return;
  }

  const { fixtures: fixtureStore } = getStores();
  const affectedUniverses = new Set<number>();

  // Process each fixture in the frame
  for (const [fixtureId, attrs] of Object.entries(frame.fixtures)) {
    const fixture = fixtureStore.getById(fixtureId);
    if (!fixture) continue;

    const model = fixtureStore.getModel(fixture.modelId);
    if (!model) continue;

    const dmxBuffer = getDmxBuffer(fixture.universe);
    applyAttributesToDmx(dmxBuffer, fixture.startChannel, model, attrs);
    affectedUniverses.add(fixture.universe);
  }

  // Send DMX for affected universes
  for (const universe of affectedUniverses) {
    const dmxBuffer = getDmxBuffer(universe);
    const sequence = getNextSequence(universe);
    const packet = createArtDmxPacket(universe, dmxBuffer, sequence);

    socket.send(packet, ARTNET_PORT, broadcastAddress, (err) => {
      if (err) {
        console.error(`Failed to send Art-Net packet for universe ${universe}:`, err);
      }
    });
  }
}

/**
 * Send blackout to all active universes
 */
export function sendBlackout(broadcastAddress = '2.255.255.255'): void {
  if (!socket) return;

  for (const [universe, dmxBuffer] of dmxBuffers) {
    dmxBuffer.fill(0);
    const sequence = getNextSequence(universe);
    const packet = createArtDmxPacket(universe, dmxBuffer, sequence);

    socket.send(packet, ARTNET_PORT, broadcastAddress);
  }
}

/**
 * Shutdown the Art-Net bridge
 */
export async function shutdownArtNetBridge(): Promise<void> {
  if (!socket) return;

  sendBlackout();

  return new Promise((resolve) => {
    socket!.close(() => {
      socket = null;
      dmxBuffers.clear();
      sequenceCounters.clear();
      console.log('Art-Net bridge shut down');
      resolve();
    });
  });
}

/**
 * Check if the bridge is initialized
 */
export function isArtNetBridgeInitialized(): boolean {
  return socket !== null;
}
