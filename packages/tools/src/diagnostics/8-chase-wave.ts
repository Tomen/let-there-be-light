#!/usr/bin/env tsx
/**
 * Tool 8: Chase Wave
 *
 * Creates a wavy chase effect across RGB fixtures, interpolating between colors.
 *
 * Usage: npm run chase
 */

import dgram from 'dgram';
import { config, refreshIntervalMs } from '../config.js';
import { createArtDmx, createDmxBuffer } from '../artnet-protocol.js';
import { getFixtureStore, mapColorToChannels, RGBWColor } from '../fixtures.js';

// Hardcoded colors for the wave
const WAVE_COLORS: RGBWColor[] = [
  { r: 0, g: 0, b: 255, w: 0 },      // Blue
  { r: 128, g: 0, b: 255, w: 0 },    // Purple
  { r: 255, g: 0, b: 128, w: 0 },    // Pink
];

// Wave settings
const GROUP_NAME = 'rgb-luster';
const WAVE_SPEED = 0.05;  // How fast the wave moves (higher = faster)
const WAVE_LENGTH = 20;   // How many fixtures span one full color cycle

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

// DMX state
const dmxState = new Map<number, Buffer>();
const sequenceCounters = new Map<number, number>();
let socket: dgram.Socket;

function getDmxBuffer(universe: number): Buffer {
  if (!dmxState.has(universe)) {
    dmxState.set(universe, createDmxBuffer());
    sequenceCounters.set(universe, 1);
  }
  return dmxState.get(universe)!;
}

function getNextSequence(universe: number): number {
  const current = sequenceCounters.get(universe) || 1;
  const next = current >= 255 ? 1 : current + 1;
  sequenceCounters.set(universe, next);
  return current;
}

function sendDmxOutput(): void {
  for (const [universe, dmxBuffer] of dmxState) {
    const sequence = getNextSequence(universe);
    const artDmx = createArtDmx(universe, dmxBuffer, sequence);
    socket.send(artDmx, config.artnet.port, config.network.broadcast, () => {});
  }
}

// Interpolate between two colors
function lerpColor(c1: RGBWColor, c2: RGBWColor, t: number): RGBWColor {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
    w: Math.round(c1.w + (c2.w - c1.w) * t),
  };
}

// Get color from wave position (0 to 1 maps across all colors)
function getWaveColor(position: number): RGBWColor {
  // Wrap position to 0-1 range
  position = position - Math.floor(position);

  const numColors = WAVE_COLORS.length;
  const scaledPos = position * numColors;
  const colorIndex = Math.floor(scaledPos);
  const t = scaledPos - colorIndex;

  const c1 = WAVE_COLORS[colorIndex % numColors];
  const c2 = WAVE_COLORS[(colorIndex + 1) % numColors];

  return lerpColor(c1, c2, t);
}

async function main(): Promise<void> {
  // Load fixtures
  const fixtureStore = getFixtureStore();
  try {
    fixtureStore.load();
  } catch (err) {
    log(`Failed to load fixtures: ${err}`, colors.red);
    process.exit(1);
  }

  const fixtures = fixtureStore.getGroup(GROUP_NAME);
  if (fixtures.length === 0) {
    log(`Group "${GROUP_NAME}" not found or empty`, colors.red);
    process.exit(1);
  }

  // Create socket
  socket = dgram.createSocket('udp4');
  await new Promise<void>((resolve) => {
    socket.bind(() => {
      socket.setBroadcast(true);
      resolve();
    });
  });

  // Start continuous output
  const outputInterval = setInterval(sendDmxOutput, refreshIntervalMs);

  console.log('');
  log('════════════════════════════════════════════', colors.cyan);
  log('             Chase Wave Effect              ', colors.cyan);
  log('════════════════════════════════════════════', colors.cyan);
  console.log('');
  log(`Group: ${GROUP_NAME} (${fixtures.length} fixtures)`, colors.yellow);
  log(`Colors: Blue -> Purple -> Pink`, colors.yellow);
  console.log('');
  log('Press Ctrl+C to stop', colors.cyan);
  console.log('');

  let phase = 0;

  function updateWave(): void {
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];

      // Calculate wave position for this fixture
      const wavePosition = (i / WAVE_LENGTH) + phase;
      const color = getWaveColor(wavePosition);

      // Apply color to fixture
      const channelValues = mapColorToChannels(fixture, color);
      const dmxBuffer = getDmxBuffer(channelValues.universe);

      for (const { channel, value } of channelValues.channels) {
        dmxBuffer[channel - 1] = value;
      }
    }

    // Advance the wave
    phase += WAVE_SPEED;
  }

  // Update wave at 30fps
  const waveInterval = setInterval(updateWave, 33);
  updateWave(); // Initial update

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n');
    log('Stopping...', colors.yellow);

    clearInterval(waveInterval);

    // Turn off all fixtures
    for (const fixture of fixtures) {
      const channelValues = mapColorToChannels(fixture, { r: 0, g: 0, b: 0, w: 0 });
      const dmxBuffer = getDmxBuffer(channelValues.universe);
      for (const { channel, value } of channelValues.channels) {
        dmxBuffer[channel - 1] = value;
      }
    }
    sendDmxOutput();

    setTimeout(() => {
      clearInterval(outputInterval);
      socket.close();
      log('Done', colors.cyan);
      process.exit(0);
    }, 100);
  });
}

main().catch((err) => {
  log(`Error: ${err}`, colors.red);
  process.exit(1);
});
