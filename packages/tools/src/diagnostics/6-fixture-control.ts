#!/usr/bin/env tsx
/**
 * Tool 6: Fixture Control
 *
 * CLI for controlling fixtures and groups by name.
 * Loads fixture definitions from fixtures.yaml.
 *
 * Usage:
 *   npm run fixture                          - Interactive mode
 *   npm run fixture color <name> <color>     - One-shot command
 *   npm run fixture off <name>               - One-shot command
 *   npm run fixture blackout                 - One-shot command
 *
 * Commands:
 *   list                          - Show all fixtures and groups
 *   color <fixture|group> <color> - Set to named color (red, blue, white, etc.)
 *   rgb <fixture|group> <r> <g> <b> - Set to RGB values
 *   off <fixture|group>           - Turn off (all channels to 0)
 *   blackout                      - All fixtures off
 *   status                        - Show current state
 *   help                          - Show commands
 *   quit                          - Exit (interactive mode only)
 */

import dgram from 'dgram';
import inquirer from 'inquirer';
import { config, refreshIntervalMs } from '../config.js';
import { createArtDmx, createDmxBuffer, formatUniverse } from '../artnet-protocol.js';
import {
  getFixtureStore,
  Fixture,
  RGBWColor,
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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

// DMX state - map of universe number to 512-byte buffer
const dmxState = new Map<number, Buffer>();

// Sequence counters per universe
const sequenceCounters = new Map<number, number>();

// UDP socket
let socket: dgram.Socket;

// Output interval
let outputInterval: NodeJS.Timeout | null = null;

// Fixture store
const fixtureStore = getFixtureStore();

/**
 * Get or create DMX buffer for a universe
 */
function getDmxBuffer(universe: number): Buffer {
  if (!dmxState.has(universe)) {
    dmxState.set(universe, createDmxBuffer());
    sequenceCounters.set(universe, 1);
  }
  return dmxState.get(universe)!;
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
 * Send DMX data for all active universes
 */
function sendDmxOutput(): void {
  for (const [universe, dmxBuffer] of dmxState) {
    const sequence = getNextSequence(universe);
    const artDmx = createArtDmx(universe, dmxBuffer, sequence);

    socket.send(artDmx, config.artnet.port, config.network.broadcast, () => {
      // Ignore send errors
    });
  }
}

/**
 * Start continuous Art-Net output
 */
function startOutput(): void {
  if (outputInterval) return;

  outputInterval = setInterval(sendDmxOutput, refreshIntervalMs);
  sendDmxOutput();
}

/**
 * Stop continuous Art-Net output
 */
function stopOutput(): void {
  if (outputInterval) {
    clearInterval(outputInterval);
    outputInterval = null;
  }
}

/**
 * Resolve a name to fixture(s) - could be a fixture name or group name
 */
function resolveFixtures(name: string): Fixture[] {
  // Try as fixture first
  const fixture = fixtureStore.getFixture(name);
  if (fixture) {
    return [fixture];
  }

  // Try as group
  const group = fixtureStore.getGroup(name);
  if (group.length > 0) {
    return group;
  }

  return [];
}

/**
 * Apply a color to a fixture
 */
function applyColorToFixture(fixture: Fixture, color: RGBWColor): void {
  const channelValues = mapColorToChannels(fixture, color);
  const dmxBuffer = getDmxBuffer(channelValues.universe);

  for (const { channel, value } of channelValues.channels) {
    dmxBuffer[channel - 1] = value;
  }
}

/**
 * Turn off a fixture
 */
function turnOffFixture(fixture: Fixture): void {
  const channelValues = mapOffToChannels(fixture);
  const dmxBuffer = getDmxBuffer(channelValues.universe);

  for (const { channel, value } of channelValues.channels) {
    dmxBuffer[channel - 1] = value;
  }
}

/**
 * Set color on fixture(s) by name
 */
function setColor(name: string, colorInput: string | RGBWColor): boolean {
  const fixtures = resolveFixtures(name);
  if (fixtures.length === 0) {
    log(`Unknown fixture or group: "${name}"`, colors.red);
    return false;
  }

  const color = parseColor(colorInput);
  if (!color) {
    log(`Unknown color: "${colorInput}"`, colors.red);
    log(`Available colors: ${Object.keys(NAMED_COLORS).join(', ')}`, colors.gray);
    return false;
  }

  for (const fixture of fixtures) {
    applyColorToFixture(fixture, color);
  }

  const isGroup = fixtures.length > 1;
  const colorName = typeof colorInput === 'string' ? colorInput : `rgb(${color.r},${color.g},${color.b})`;
  log(
    `Set ${isGroup ? 'group' : 'fixture'} "${name}" (${fixtures.length} fixture${fixtures.length > 1 ? 's' : ''}) to ${colorName}`,
    colors.green
  );
  return true;
}

/**
 * Turn off fixture(s) by name
 */
function setOff(name: string): boolean {
  const fixtures = resolveFixtures(name);
  if (fixtures.length === 0) {
    log(`Unknown fixture or group: "${name}"`, colors.red);
    return false;
  }

  for (const fixture of fixtures) {
    turnOffFixture(fixture);
  }

  const isGroup = fixtures.length > 1;
  log(
    `Turned off ${isGroup ? 'group' : 'fixture'} "${name}" (${fixtures.length} fixture${fixtures.length > 1 ? 's' : ''})`,
    colors.yellow
  );
  return true;
}

/**
 * Blackout all active universes (only ones we're controlling)
 */
function blackout(): void {
  if (dmxState.size === 0) {
    log('Blackout - no active universes', colors.yellow);
    return;
  }

  for (const [, dmxBuffer] of dmxState) {
    dmxBuffer.fill(0);
  }
  log(`Blackout - ${dmxState.size} universe(s) set to 0`, colors.yellow);
}

/**
 * List fixtures and groups
 */
function listFixtures(): void {
  console.log('');
  log('Fixtures:', colors.bold);
  log('─────────────────────────────────────────────');

  const fixtures = fixtureStore.getAllFixtures();
  if (fixtures.length === 0) {
    log('  No fixtures defined', colors.gray);
  } else {
    for (const fixture of fixtures) {
      const channels = Object.keys(fixture.model.channels).join(', ');
      log(
        `  ${colors.cyan}${fixture.name}${colors.reset} - ${fixture.model.brand} ${fixture.model.model}`
      );
      log(
        `    Universe ${formatUniverse(fixture.universe)}, Ch ${fixture.startChannel} (${channels})`,
        colors.gray
      );
    }
  }

  console.log('');
  log('Groups:', colors.bold);
  log('─────────────────────────────────────────────');

  const groupNames = fixtureStore.getGroupNames();
  if (groupNames.length === 0) {
    log('  No groups defined', colors.gray);
  } else {
    for (const name of groupNames) {
      const group = fixtureStore.getGroup(name);
      const fixtureNames = group.map((f) => f.name).join(', ');
      log(`  ${colors.magenta}${name}${colors.reset} - ${group.length} fixtures`);
      log(`    ${fixtureNames}`, colors.gray);
    }
  }

  console.log('');
  log('Colors:', colors.bold);
  log('─────────────────────────────────────────────');
  log(`  ${Object.keys(NAMED_COLORS).join(', ')}`, colors.gray);
  console.log('');
}

/**
 * Show current state
 */
function showStatus(): void {
  console.log('');
  log('Current State:', colors.bold);
  log('─────────────────────────────────────────────');

  const fixtures = fixtureStore.getAllFixtures();
  for (const fixture of fixtures) {
    const dmxBuffer = dmxState.get(fixture.universe);
    if (!dmxBuffer) {
      log(`  ${fixture.name}: ${colors.gray}(no data)${colors.reset}`);
      continue;
    }

    const channelMap = fixture.model.channels;
    const values: string[] = [];

    if (channelMap.dimmer !== undefined) {
      values.push(`dim=${dmxBuffer[fixture.startChannel + channelMap.dimmer - 2]}`);
    }
    if (channelMap.red !== undefined) {
      values.push(`R=${dmxBuffer[fixture.startChannel + channelMap.red - 2]}`);
    }
    if (channelMap.green !== undefined) {
      values.push(`G=${dmxBuffer[fixture.startChannel + channelMap.green - 2]}`);
    }
    if (channelMap.blue !== undefined) {
      values.push(`B=${dmxBuffer[fixture.startChannel + channelMap.blue - 2]}`);
    }
    if (channelMap.white !== undefined) {
      values.push(`W=${dmxBuffer[fixture.startChannel + channelMap.white - 2]}`);
    }

    log(`  ${colors.cyan}${fixture.name}${colors.reset}: ${values.join(', ')}`);
  }

  console.log('');
  log(
    `Output: ${outputInterval ? colors.green + 'Active' : colors.red + 'Stopped'}${colors.reset} (${config.artnet.refreshRateHz} Hz)`
  );
  log(`Target: ${config.network.broadcast}:${config.artnet.port}`);
  console.log('');
}

/**
 * Show help
 */
function showHelp(): void {
  console.log('');
  log('Available Commands:', colors.bold);
  log('─────────────────────────────────────────────');
  log('  list                            Show all fixtures and groups');
  log('  color <name> <color>            Set fixture/group to named color');
  log('  rgb <name> <r> <g> <b>          Set fixture/group to RGB values');
  log('  off <name>                      Turn off fixture/group');
  log('  blackout                        All fixtures off');
  log('  status                          Show current state');
  log('  help                            Show this help');
  log('  quit                            Exit (sends blackout first)');
  console.log('');
  log('Examples:', colors.gray);
  log('  color front red         → Set "front" group to red');
  log('  color stage-left blue   → Set "stage-left" fixture to blue');
  log('  rgb all 255 128 0       → Set "all" group to orange');
  log('  off stage               → Turn off "stage" group');
  console.log('');
}

/**
 * Parse and execute a command
 */
function executeCommand(input: string): boolean {
  const parts = input.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();

  switch (command) {
    case 'list':
    case 'ls':
    case 'l':
      listFixtures();
      break;

    case 'color':
    case 'c': {
      const name = parts[1];
      const colorName = parts[2];

      if (!name || !colorName) {
        log('Usage: color <fixture|group> <color>', colors.red);
        log('Example: color front red', colors.gray);
      } else {
        setColor(name, colorName);
      }
      break;
    }

    case 'rgb': {
      const name = parts[1];
      const r = parseInt(parts[2], 10);
      const g = parseInt(parts[3], 10);
      const b = parseInt(parts[4], 10);

      if (!name || isNaN(r) || isNaN(g) || isNaN(b)) {
        log('Usage: rgb <fixture|group> <r> <g> <b>', colors.red);
        log('Example: rgb front 255 128 0', colors.gray);
      } else if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        log('RGB values must be 0-255', colors.red);
      } else {
        setColor(name, { r, g, b });
      }
      break;
    }

    case 'off':
    case 'o': {
      const name = parts[1];
      if (!name) {
        log('Usage: off <fixture|group>', colors.red);
        log('Example: off front', colors.gray);
      } else {
        setOff(name);
      }
      break;
    }

    case 'blackout':
    case 'bo':
      blackout();
      break;

    case 'status':
    case 'stat':
    case 's':
      showStatus();
      break;

    case 'help':
    case 'h':
    case '?':
      showHelp();
      break;

    case 'quit':
    case 'exit':
    case 'q':
      return false;

    case '':
      break;

    default:
      log(`Unknown command: ${command}`, colors.red);
      log('Type "help" for available commands', colors.gray);
  }

  return true;
}

/**
 * Main prompt loop
 */
async function promptLoop(): Promise<void> {
  while (true) {
    try {
      const { command } = await inquirer.prompt<{ command: string }>([
        {
          type: 'input',
          name: 'command',
          message: colors.cyan + '>' + colors.reset,
          prefix: '',
        },
      ]);

      const shouldContinue = executeCommand(command);
      if (!shouldContinue) {
        break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Cleanup and exit
 */
function cleanup(): void {
  log('Shutting down...', colors.yellow);

  blackout();
  sendDmxOutput();
  stopOutput();

  setTimeout(() => {
    socket.close();
    log('Goodbye!', colors.cyan);
    process.exit(0);
  }, 100);
}

/**
 * Initialize socket and fixtures
 */
async function initialize(): Promise<void> {
  // Load fixtures
  try {
    fixtureStore.load();
  } catch (err) {
    log(`Failed to load fixtures: ${err}`, colors.red);
    process.exit(1);
  }

  // Create and configure socket
  socket = dgram.createSocket('udp4');

  socket.on('error', (err) => {
    log(`Socket error: ${err.message}`, colors.red);
    process.exit(1);
  });

  // Bind and start
  await new Promise<void>((resolve) => {
    socket.bind(() => {
      socket.setBroadcast(true);
      resolve();
    });
  });

  // NOTE: We do NOT pre-initialize universes anymore.
  // Buffers are created on-demand when a command targets a fixture.
  // This prevents sending zeros to universes we're not actively controlling.

  // Start continuous output (only sends to universes with buffers)
  startOutput();
}

/**
 * Run one-shot command mode
 */
async function runOneShotCommand(args: string[]): Promise<void> {
  await initialize();

  // Execute the command
  const command = args.join(' ');
  executeCommand(command);

  // Send a few frames to ensure the command is transmitted
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Close socket and exit
  socket.close();
  process.exit(0);
}

/**
 * Run interactive mode
 */
async function runInteractiveMode(): Promise<void> {
  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║         Fixture Control CLI                ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  await initialize();

  const fixtures = fixtureStore.getAllFixtures();
  const groups = fixtureStore.getGroupNames();
  log(`Loaded ${fixtures.length} fixtures, ${groups.length} groups`, colors.green);

  console.log('');
  log(`Target: ${config.network.broadcast}:${config.artnet.port}`, colors.gray);
  log(`Refresh: ${config.artnet.refreshRateHz} Hz`, colors.gray);
  console.log('');
  log('Type "list" to see fixtures, "help" for commands', colors.yellow);
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);
  console.log('');

  log('Art-Net output started', colors.green);
  console.log('');

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('');
    cleanup();
  });

  // Start prompt loop
  await promptLoop();

  // Normal exit
  cleanup();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // One-shot command mode
    await runOneShotCommand(args);
  } else {
    // Interactive mode
    await runInteractiveMode();
  }
}

// Run
main().catch((error) => {
  log(`Error: ${error}`, colors.red);
  process.exit(1);
});
