#!/usr/bin/env tsx
/**
 * Tool 2: Art-Net Sniffer
 *
 * Listens on UDP port 6454 and displays any Art-Net packets seen on the network.
 * Useful to verify that the GrandMA2 is actively outputting Art-Net data.
 *
 * Usage: npm run sniff
 * Press Ctrl+C to stop
 */

import dgram from 'dgram';
import { config } from './config.js';
import {
  parsePacket,
  parseArtDmx,
  parseArtPollReply,
  OpCode,
  formatUniverse,
} from './artnet-protocol.js';

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

// Track packet statistics
interface PacketStats {
  total: number;
  byType: Map<string, number>;
  bySource: Map<string, number>;
  byUniverse: Map<number, number>;
}

const stats: PacketStats = {
  total: 0,
  byType: new Map(),
  bySource: new Map(),
  byUniverse: new Map(),
};

/**
 * Format a timestamp for display
 */
function timestamp(): string {
  const now = new Date();
  return now.toISOString().substring(11, 23);
}

/**
 * Format DMX values for display (show first few and last few)
 */
function formatDmxPreview(dmxData: Buffer): string {
  if (dmxData.length === 0) return '(empty)';

  // Find first and last non-zero values
  let firstNonZero = -1;
  let lastNonZero = -1;

  for (let i = 0; i < dmxData.length; i++) {
    if (dmxData[i] !== 0) {
      if (firstNonZero === -1) firstNonZero = i;
      lastNonZero = i;
    }
  }

  if (firstNonZero === -1) {
    return '(all zeros - blackout)';
  }

  // Count non-zero channels
  let nonZeroCount = 0;
  for (let i = 0; i < dmxData.length; i++) {
    if (dmxData[i] !== 0) nonZeroCount++;
  }

  return `${nonZeroCount} active channels, first active: ch${firstNonZero + 1}=${dmxData[firstNonZero]}`;
}

/**
 * Handle an incoming packet
 */
function handlePacket(msg: Buffer, rinfo: dgram.RemoteInfo): void {
  const packet = parsePacket(msg);

  if (!packet) {
    // Not an Art-Net packet
    log(`${timestamp()} ${colors.gray}[${rinfo.address}:${rinfo.port}] Non-Art-Net packet (${msg.length} bytes)${colors.reset}`);
    return;
  }

  stats.total++;
  stats.byType.set(packet.opCodeName, (stats.byType.get(packet.opCodeName) || 0) + 1);
  stats.bySource.set(rinfo.address, (stats.bySource.get(rinfo.address) || 0) + 1);

  // Format based on packet type
  switch (packet.opCode) {
    case OpCode.ArtDmx: {
      const dmx = parseArtDmx(msg);
      if (dmx) {
        stats.byUniverse.set(dmx.universe, (stats.byUniverse.get(dmx.universe) || 0) + 1);

        const preview = formatDmxPreview(dmx.dmxData);
        log(
          `${colors.gray}${timestamp()}${colors.reset} ` +
          `${colors.cyan}[${rinfo.address}]${colors.reset} ` +
          `${colors.green}ArtDmx${colors.reset} ` +
          `Universe ${colors.yellow}${formatUniverse(dmx.universe)}${colors.reset} ` +
          `Seq=${dmx.sequence} ` +
          `${colors.gray}${preview}${colors.reset}`
        );
      }
      break;
    }

    case OpCode.ArtPoll: {
      log(
        `${colors.gray}${timestamp()}${colors.reset} ` +
        `${colors.cyan}[${rinfo.address}]${colors.reset} ` +
        `${colors.magenta}ArtPoll${colors.reset} ` +
        `${colors.gray}(discovery request)${colors.reset}`
      );
      break;
    }

    case OpCode.ArtPollReply: {
      const reply = parseArtPollReply(msg);
      if (reply) {
        log(
          `${colors.gray}${timestamp()}${colors.reset} ` +
          `${colors.cyan}[${rinfo.address}]${colors.reset} ` +
          `${colors.magenta}ArtPollReply${colors.reset} ` +
          `"${colors.yellow}${reply.shortName}${colors.reset}" ` +
          `${colors.gray}${reply.longName}${colors.reset}`
        );
      }
      break;
    }

    case OpCode.ArtSync: {
      log(
        `${colors.gray}${timestamp()}${colors.reset} ` +
        `${colors.cyan}[${rinfo.address}]${colors.reset} ` +
        `${colors.yellow}ArtSync${colors.reset}`
      );
      break;
    }

    default: {
      log(
        `${colors.gray}${timestamp()}${colors.reset} ` +
        `${colors.cyan}[${rinfo.address}]${colors.reset} ` +
        `${colors.gray}${packet.opCodeName} (${msg.length} bytes)${colors.reset}`
      );
    }
  }
}

/**
 * Display statistics on exit
 */
function showStats(): void {
  console.log('');
  log('═══════════════════════════════════════════════', colors.cyan);
  log('Session Statistics:', colors.bold);
  console.log('');
  log(`  Total packets: ${stats.total}`);

  if (stats.byType.size > 0) {
    console.log('');
    log('  By Type:');
    for (const [type, count] of stats.byType) {
      log(`    ${type}: ${count}`);
    }
  }

  if (stats.bySource.size > 0) {
    console.log('');
    log('  By Source:');
    for (const [source, count] of stats.bySource) {
      log(`    ${source}: ${count}`);
    }
  }

  if (stats.byUniverse.size > 0) {
    console.log('');
    log('  By Universe (DMX only):');
    const sorted = [...stats.byUniverse.entries()].sort((a, b) => a[0] - b[0]);
    for (const [universe, count] of sorted) {
      log(`    Universe ${formatUniverse(universe)}: ${count}`);
    }
  }

  console.log('');
  log('═══════════════════════════════════════════════', colors.cyan);
}

/**
 * Main function
 */
function main(): void {
  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║         Art-Net Packet Sniffer             ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  log(`Listening on UDP port ${config.artnet.port}`, colors.yellow);
  log('Press Ctrl+C to stop', colors.gray);
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);
  console.log('');

  // Create UDP socket
  const socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true, // Allow multiple processes to bind to the same port
  });

  // Handle incoming packets
  socket.on('message', handlePacket);

  // Handle errors
  socket.on('error', (err) => {
    log(`Socket error: ${err.message}`, colors.red);
    socket.close();
    process.exit(1);
  });

  // Bind to Art-Net port
  socket.bind(config.artnet.port, () => {
    const address = socket.address();
    log(`Bound to ${address.address}:${address.port}`, colors.green);
    console.log('');
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('');
    log('Stopping sniffer...', colors.yellow);
    showStats();
    socket.close();
    process.exit(0);
  });

}

// Run
main();
