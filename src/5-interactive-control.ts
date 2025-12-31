#!/usr/bin/env tsx
/**
 * Tool 5: Interactive Control
 *
 * A full interactive CLI for controlling Art-Net DMX channels.
 * Maintains DMX state and continuously outputs Art-Net at the configured refresh rate.
 *
 * Usage: npm run control
 *
 * Commands:
 *   set <universe> <channel> <value>  - Set a single channel
 *   all <universe> <value>            - Set all 512 channels to same value
 *   blackout                          - All channels to 0
 *   chase <universe>                  - Cycle through channels one at a time
 *   status                            - Show current state
 *   help                              - Show commands
 *   quit                              - Exit
 */

import dgram from 'dgram';
import inquirer from 'inquirer';
import { config, refreshIntervalMs } from './config.js';
import { createArtDmx, createDmxBuffer, formatUniverse } from './artnet-protocol.js';

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

// Chase state
let chaseActive = false;
let chaseUniverse = 0;
let chaseChannel = 1;
let chaseInterval: NodeJS.Timeout | null = null;

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

    socket.send(artDmx, config.artnet.port, config.network.broadcast, (err) => {
      if (err) {
        // Don't spam errors, just log once
      }
    });
  }
}

/**
 * Start continuous Art-Net output
 */
function startOutput(): void {
  if (outputInterval) return;

  outputInterval = setInterval(sendDmxOutput, refreshIntervalMs);
  // Send immediately too
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
 * Set a single channel value
 */
function setChannel(universe: number, channel: number, value: number): void {
  if (channel < 1 || channel > 512) {
    log('Channel must be 1-512', colors.red);
    return;
  }
  if (value < 0 || value > 255) {
    log('Value must be 0-255', colors.red);
    return;
  }

  const dmxBuffer = getDmxBuffer(universe);
  dmxBuffer[channel - 1] = value;

  log(
    `Set universe ${formatUniverse(universe)} channel ${channel} to ${value} (${Math.round((value / 255) * 100)}%)`,
    colors.green
  );
}

/**
 * Set all channels in a universe to the same value
 */
function setAll(universe: number, value: number): void {
  if (value < 0 || value > 255) {
    log('Value must be 0-255', colors.red);
    return;
  }

  const dmxBuffer = getDmxBuffer(universe);
  dmxBuffer.fill(value);

  log(
    `Set all 512 channels in universe ${formatUniverse(universe)} to ${value} (${Math.round((value / 255) * 100)}%)`,
    colors.green
  );
}

/**
 * Blackout all universes
 */
function blackout(): void {
  for (const [universe, dmxBuffer] of dmxState) {
    dmxBuffer.fill(0);
  }

  // Also ensure universe 0 exists and is blacked out
  getDmxBuffer(0).fill(0);

  log('Blackout - all channels set to 0', colors.yellow);
}

/**
 * Start a chase effect - cycles through channels one at a time
 */
function startChase(universe: number): void {
  if (chaseActive) {
    stopChase();
  }

  chaseActive = true;
  chaseUniverse = universe;
  chaseChannel = 1;

  // Initialize universe
  const dmxBuffer = getDmxBuffer(universe);
  dmxBuffer.fill(0);

  log(`Starting chase on universe ${formatUniverse(universe)}`, colors.magenta);
  log('Press Enter to stop chase', colors.gray);

  chaseInterval = setInterval(() => {
    // Clear previous channel
    dmxBuffer[chaseChannel - 1] = 0;

    // Move to next channel
    chaseChannel = chaseChannel >= 512 ? 1 : chaseChannel + 1;

    // Set new channel
    dmxBuffer[chaseChannel - 1] = 255;

    // Display current channel
    process.stdout.write(
      `\r${colors.magenta}Chase: ${colors.yellow}Channel ${chaseChannel}${colors.reset}    `
    );
  }, 100); // 100ms per channel = ~5 seconds for full cycle
}

/**
 * Stop chase effect
 */
function stopChase(): void {
  if (chaseInterval) {
    clearInterval(chaseInterval);
    chaseInterval = null;
  }

  if (chaseActive) {
    // Clear chase channel
    const dmxBuffer = getDmxBuffer(chaseUniverse);
    dmxBuffer.fill(0);

    chaseActive = false;
    console.log('');
    log('Chase stopped', colors.yellow);
  }
}

/**
 * Show current state
 */
function showStatus(): void {
  console.log('');
  log('Current State:', colors.bold);
  log('─────────────────────────────────────────────');

  if (dmxState.size === 0) {
    log('  No universes active', colors.gray);
  } else {
    for (const [universe, dmxBuffer] of dmxState) {
      // Count non-zero channels
      let activeCount = 0;
      let firstActive = -1;
      let lastActive = -1;

      for (let i = 0; i < 512; i++) {
        if (dmxBuffer[i] !== 0) {
          activeCount++;
          if (firstActive === -1) firstActive = i + 1;
          lastActive = i + 1;
        }
      }

      log(`  Universe ${formatUniverse(universe)}:`, colors.cyan);
      if (activeCount === 0) {
        log(`    All channels at 0 (blackout)`, colors.gray);
      } else {
        log(`    ${activeCount} active channel(s)`);
        log(`    First active: ch${firstActive} = ${dmxBuffer[firstActive - 1]}`);
        if (firstActive !== lastActive) {
          log(`    Last active: ch${lastActive} = ${dmxBuffer[lastActive - 1]}`);
        }
      }
    }
  }

  console.log('');
  log(`Output: ${outputInterval ? colors.green + 'Active' : colors.red + 'Stopped'}${colors.reset} (${config.artnet.refreshRateHz} Hz)`);
  log(`Target: ${config.network.broadcast}:${config.artnet.port}`);

  if (chaseActive) {
    log(`Chase: ${colors.magenta}Active${colors.reset} on universe ${chaseUniverse}, channel ${chaseChannel}`);
  }

  console.log('');
}

/**
 * Show help
 */
function showHelp(): void {
  console.log('');
  log('Available Commands:', colors.bold);
  log('─────────────────────────────────────────────');
  log('  set <universe> <channel> <value>  Set a single channel (1-512) to value (0-255)');
  log('  all <universe> <value>            Set all 512 channels to same value');
  log('  blackout                          Set all channels in all universes to 0');
  log('  chase <universe>                  Cycle through channels (100ms each)');
  log('  status                            Show current state');
  log('  help                              Show this help');
  log('  quit                              Exit (sends blackout first)');
  console.log('');
  log('Examples:', colors.gray);
  log('  set 0 1 255     → Universe 0, channel 1 at 100%');
  log('  set 0 5 128     → Universe 0, channel 5 at 50%');
  log('  all 0 255       → All channels in universe 0 at 100%');
  log('  chase 0         → Chase effect on universe 0');
  console.log('');
}

/**
 * Parse and execute a command
 */
function executeCommand(input: string): boolean {
  const parts = input.trim().toLowerCase().split(/\s+/);
  const command = parts[0];

  // Stop chase if any command is entered
  if (chaseActive && command !== '') {
    stopChase();
    if (command === '') return true; // Just stopping chase
  }

  switch (command) {
    case 'set': {
      const universe = parseInt(parts[1], 10);
      const channel = parseInt(parts[2], 10);
      const value = parseInt(parts[3], 10);

      if (isNaN(universe) || isNaN(channel) || isNaN(value)) {
        log('Usage: set <universe> <channel> <value>', colors.red);
        log('Example: set 0 1 255', colors.gray);
      } else {
        setChannel(universe, channel, value);
      }
      break;
    }

    case 'all': {
      const universe = parseInt(parts[1], 10);
      const value = parseInt(parts[2], 10);

      if (isNaN(universe) || isNaN(value)) {
        log('Usage: all <universe> <value>', colors.red);
        log('Example: all 0 255', colors.gray);
      } else {
        setAll(universe, value);
      }
      break;
    }

    case 'blackout':
    case 'bo':
      blackout();
      break;

    case 'chase': {
      const universe = parseInt(parts[1], 10);
      if (isNaN(universe)) {
        log('Usage: chase <universe>', colors.red);
        log('Example: chase 0', colors.gray);
      } else {
        startChase(universe);
      }
      break;
    }

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
      return false; // Signal to exit

    case '':
      // Empty input, just continue
      break;

    default:
      log(`Unknown command: ${command}`, colors.red);
      log('Type "help" for available commands', colors.gray);
  }

  return true; // Continue running
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
    } catch (error) {
      // Handle Ctrl+C during prompt
      break;
    }
  }
}

/**
 * Cleanup and exit
 */
function cleanup(): void {
  log('Shutting down...', colors.yellow);

  // Stop chase
  stopChase();

  // Send blackout
  blackout();

  // Send one more DMX frame to ensure blackout is sent
  sendDmxOutput();

  // Stop output
  stopOutput();

  // Close socket
  setTimeout(() => {
    socket.close();
    log('Goodbye!', colors.cyan);
    process.exit(0);
  }, 100);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║       Art-Net Interactive Control          ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  log(`Target: ${config.network.broadcast}:${config.artnet.port}`, colors.gray);
  log(`Refresh: ${config.artnet.refreshRateHz} Hz`, colors.gray);
  console.log('');
  log('Type "help" for available commands', colors.yellow);
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);
  console.log('');

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

  // Initialize universe 0
  getDmxBuffer(0);

  // Start continuous output
  startOutput();

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

// Run
main().catch((error) => {
  log(`Error: ${error}`, colors.red);
  process.exit(1);
});
