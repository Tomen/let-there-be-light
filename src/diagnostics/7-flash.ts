#!/usr/bin/env tsx
/**
 * Tool 7: Flash
 *
 * Flashes a group on and off at a specified interval.
 *
 * Usage: npm run flash <group> [interval] [color]
 *
 * Examples:
 *   npm run flash rgb-luster
 *   npm run flash rgb-luster 3
 *   npm run flash rgb-luster 1 blue
 */

import dgram from 'dgram';
import { config, refreshIntervalMs } from '../config.js';
import { createArtDmx, createDmxBuffer } from '../artnet-protocol.js';
import {
  getFixtureStore,
  parseColor,
  mapColorToChannels,
  mapOffToChannels,
  NAMED_COLORS,
} from '../fixtures.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const groupName = args[0];
  const intervalSec = parseFloat(args[1]) || 3;
  const colorName = args[2] || 'white';

  if (!groupName) {
    console.log(`
Usage: npm run flash <group> [interval] [color]

Arguments:
  group     Name of the fixture group to flash
  interval  Seconds between on/off (default: 3)
  color     Color when on (default: white)

Examples:
  npm run flash rgb-luster
  npm run flash rgb-luster 3
  npm run flash rgb-luster 1 blue
  npm run flash pinspots-luster 0.5 white

Available colors: ${Object.keys(NAMED_COLORS).join(', ')}
`);
    process.exit(1);
  }

  // Load fixtures
  const fixtureStore = getFixtureStore();
  try {
    fixtureStore.load();
  } catch (err) {
    log(`Failed to load fixtures: ${err}`, colors.red);
    process.exit(1);
  }

  const fixtures = fixtureStore.getGroup(groupName);
  if (fixtures.length === 0) {
    log(`Unknown group: "${groupName}"`, colors.red);
    log(`Available groups: ${fixtureStore.getGroupNames().join(', ')}`, colors.yellow);
    process.exit(1);
  }

  const parsedColor = parseColor(colorName);
  if (!parsedColor) {
    log(`Unknown color: "${colorName}"`, colors.red);
    log(`Available colors: ${Object.keys(NAMED_COLORS).join(', ')}`, colors.yellow);
    process.exit(1);
  }
  const color = parsedColor;

  // Create socket
  socket = dgram.createSocket('udp4');
  await new Promise<void>((resolve) => {
    socket.bind(() => {
      socket.setBroadcast(true);
      resolve();
    });
  });

  // Initialize universes
  const universes = new Set(fixtures.map((f) => f.universe));
  for (const universe of universes) {
    getDmxBuffer(universe);
  }

  // Start continuous output
  const outputInterval = setInterval(sendDmxOutput, refreshIntervalMs);
  sendDmxOutput();

  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║              Flash Mode                    ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');
  log(`Group: ${groupName} (${fixtures.length} fixtures)`, colors.yellow);
  log(`Interval: ${intervalSec}s`, colors.yellow);
  log(`Color: ${colorName}`, colors.yellow);
  console.log('');
  log('Press Ctrl+C to stop', colors.cyan);
  console.log('');

  let isOn = false;

  function toggle(): void {
    isOn = !isOn;

    for (const fixture of fixtures) {
      const channelValues = isOn
        ? mapColorToChannels(fixture, color)
        : mapOffToChannels(fixture);
      const dmxBuffer = getDmxBuffer(channelValues.universe);

      for (const { channel, value } of channelValues.channels) {
        dmxBuffer[channel - 1] = value;
      }
    }

    const status = isOn ? `${colors.green}ON ` : `${colors.red}OFF`;
    process.stdout.write(`\r  ${status}${colors.reset}  `);
  }

  // Start with ON
  toggle();

  // Flash interval
  const flashInterval = setInterval(toggle, intervalSec * 1000);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n');
    log('Stopping...', colors.yellow);

    clearInterval(flashInterval);

    // Turn off
    for (const fixture of fixtures) {
      const channelValues = mapOffToChannels(fixture);
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
