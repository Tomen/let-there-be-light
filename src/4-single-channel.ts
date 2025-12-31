#!/usr/bin/env tsx
/**
 * Tool 4: Single Channel Test
 *
 * Sends Art-Net DMX data to a specific universe/channel.
 * Continuously outputs at the configured refresh rate until Ctrl+C.
 *
 * Usage: npm run channel -- --universe 0 --channel 1 --value 255
 *
 * Options:
 *   --universe, -u   Universe number (0-32767, default: 0)
 *   --channel, -c    DMX channel (1-512, default: 1)
 *   --value, -v      DMX value (0-255, default: 255)
 *   --target, -t     Target IP (default: broadcast)
 */

import dgram from 'dgram';
import { config, refreshIntervalMs } from './config.js';
import { createArtDmx, createDmxBuffer, formatUniverse } from './artnet-protocol.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Parse command line arguments
 */
interface Args {
  universe: number;
  channel: number;
  value: number;
  target: string;
}

function parseArgs(): Args {
  const args: Args = {
    universe: 0,
    channel: 1,
    value: 255,
    target: config.network.broadcast,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--universe':
      case '-u':
        args.universe = parseInt(next, 10);
        i++;
        break;
      case '--channel':
      case '-c':
        args.channel = parseInt(next, 10);
        i++;
        break;
      case '--value':
      case '-v':
        args.value = parseInt(next, 10);
        i++;
        break;
      case '--target':
      case '-t':
        args.target = next;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  // Validate
  if (isNaN(args.universe) || args.universe < 0 || args.universe > 32767) {
    log('Error: Universe must be 0-32767', colors.red);
    process.exit(1);
  }
  if (isNaN(args.channel) || args.channel < 1 || args.channel > 512) {
    log('Error: Channel must be 1-512', colors.red);
    process.exit(1);
  }
  if (isNaN(args.value) || args.value < 0 || args.value > 255) {
    log('Error: Value must be 0-255', colors.red);
    process.exit(1);
  }

  return args;
}

function printHelp(): void {
  console.log(`
Art-Net Single Channel Test

Usage: npm run channel -- [options]

Options:
  --universe, -u <n>   Universe number (0-32767, default: 0)
  --channel, -c <n>    DMX channel (1-512, default: 1)
  --value, -v <n>      DMX value (0-255, default: 255)
  --target, -t <ip>    Target IP (default: ${config.network.broadcast})
  --help, -h           Show this help message

Examples:
  npm run channel                           # Channel 1 @ 255 on universe 0
  npm run channel -- -c 5 -v 128            # Channel 5 @ 128 on universe 0
  npm run channel -- -u 1 -c 10 -v 255      # Channel 10 @ 255 on universe 1
  npm run channel -- -t 2.0.0.1 -c 1 -v 200 # Direct to GrandMA2
`);
}

/**
 * Main function
 */
function main(): void {
  const args = parseArgs();

  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║       Art-Net Single Channel Test          ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  log(`Universe: ${colors.yellow}${formatUniverse(args.universe)}${colors.reset}`);
  log(`Channel:  ${colors.yellow}${args.channel}${colors.reset}`);
  log(`Value:    ${colors.yellow}${args.value}${colors.reset} (${Math.round((args.value / 255) * 100)}%)`);
  log(`Target:   ${colors.cyan}${args.target}:${config.artnet.port}${colors.reset}`);
  log(`Refresh:  ${config.artnet.refreshRateHz} Hz (${refreshIntervalMs}ms interval)`);
  console.log('');
  log('Press Ctrl+C to stop', colors.gray);
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);
  console.log('');

  // Create UDP socket
  const socket = dgram.createSocket('udp4');

  socket.on('error', (err) => {
    log(`Socket error: ${err.message}`, colors.red);
    socket.close();
    process.exit(1);
  });

  // Enable broadcast if targeting broadcast address
  socket.bind(() => {
    if (args.target === config.network.broadcast) {
      socket.setBroadcast(true);
    }

    // Create DMX buffer with our channel set
    const dmxBuffer = createDmxBuffer();
    dmxBuffer[args.channel - 1] = args.value; // DMX channels are 1-indexed

    // Sequence counter (1-255, wraps around, 0 disables)
    let sequence = 1;

    // Packet counter for display
    let packetCount = 0;

    // Send packets at refresh rate
    const sendPacket = (): void => {
      const artDmx = createArtDmx(args.universe, dmxBuffer, sequence);

      socket.send(artDmx, config.artnet.port, args.target, (err) => {
        if (err) {
          log(`Send error: ${err.message}`, colors.red);
        } else {
          packetCount++;
          // Update display every second
          if (packetCount % config.artnet.refreshRateHz === 0) {
            process.stdout.write(
              `\r${colors.green}Sending: ${colors.reset}` +
              `Universe ${formatUniverse(args.universe)} ` +
              `Ch${args.channel}=${args.value} ` +
              `${colors.gray}(${packetCount} packets, seq=${sequence})${colors.reset}  `
            );
          }
        }
      });

      // Increment sequence (1-255)
      sequence = sequence >= 255 ? 1 : sequence + 1;
    };

    // Start sending
    log('Sending Art-Net DMX data...', colors.green);
    console.log('');

    // Send immediately, then at interval
    sendPacket();
    const intervalId = setInterval(sendPacket, refreshIntervalMs);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('');
      console.log('');
      log('Stopping...', colors.yellow);

      // Send blackout before exiting
      dmxBuffer[args.channel - 1] = 0;
      const blackoutPacket = createArtDmx(args.universe, dmxBuffer, sequence);
      socket.send(blackoutPacket, config.artnet.port, args.target, () => {
        log(`Sent ${packetCount} packets total`, colors.gray);
        log('Channel set to 0 (blackout) on exit', colors.gray);
        clearInterval(intervalId);
        socket.close();
        process.exit(0);
      });
    });
  });
}

// Run
main();
