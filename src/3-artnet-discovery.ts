#!/usr/bin/env tsx
/**
 * Tool 3: Art-Net Discovery
 *
 * Broadcasts an ArtPoll packet to discover all Art-Net devices on the network.
 * Listens for ArtPollReply responses and displays discovered devices.
 *
 * Usage: npm run discover
 * Timeout: 5 seconds
 */

import dgram from 'dgram';
import { config } from './config.js';
import {
  createArtPoll,
  parsePacket,
  parseArtPollReply,
  OpCode,
  ArtPollReplyData,
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

// Discovery timeout in milliseconds
const DISCOVERY_TIMEOUT = 5000;

// Store discovered devices (keyed by IP to avoid duplicates)
const discoveredDevices = new Map<string, ArtPollReplyData>();

/**
 * Format port type flags into readable string
 */
function formatPortType(portType: number): string {
  const types: string[] = [];

  // Bits 5-0: Protocol
  // 000000 = DMX512
  // 000001 = MIDI
  // 000010 = Avab
  // 000011 = Colortran CMX
  // 000100 = ADB 62.5
  // 000101 = Art-Net

  // Bit 6: Output supported
  if (portType & 0x80) types.push('Output');
  // Bit 7: Input supported
  if (portType & 0x40) types.push('Input');

  const protocol = portType & 0x3f;
  switch (protocol) {
    case 0:
      types.push('DMX512');
      break;
    case 1:
      types.push('MIDI');
      break;
    case 5:
      types.push('Art-Net');
      break;
    default:
      types.push(`Protocol(${protocol})`);
  }

  return types.join('/') || 'Unknown';
}

/**
 * Display a discovered device
 */
function displayDevice(device: ArtPollReplyData, index: number): void {
  console.log('');
  log(`  Device #${index + 1}`, colors.bold + colors.green);
  log(`  ─────────────────────────────────────────`);

  log(`  IP Address:  ${colors.cyan}${device.ipAddress}${colors.reset}`);
  log(`  MAC Address: ${device.macAddress}`);
  log(`  Short Name:  ${colors.yellow}${device.shortName}${colors.reset}`);
  log(`  Long Name:   ${device.longName}`);

  // Firmware version
  log(`  Firmware:    v${device.versionHi}.${device.versionLo}`);

  // OEM code
  const oemCode = (device.oemHi << 8) | device.oemLo;
  log(`  OEM Code:    0x${oemCode.toString(16).padStart(4, '0')}`);

  // ESTA code
  log(`  ESTA Code:   0x${device.estaCode.toString(16).padStart(4, '0')}`);

  // Network settings
  log(`  Net/Sub:     Net ${device.netSwitch}, SubNet ${device.subSwitch}`);

  // Ports
  if (device.numPorts > 0) {
    log(`  Ports:       ${device.numPorts}`);
    for (let i = 0; i < Math.min(device.numPorts, 4); i++) {
      const portType = formatPortType(device.portTypes[i]);
      const inputUni = device.inputUniverses[i];
      const outputUni = device.outputUniverses[i];

      let portInfo = `    Port ${i + 1}: ${portType}`;
      if (device.portTypes[i] & 0x40) {
        portInfo += ` | In: ${inputUni}`;
      }
      if (device.portTypes[i] & 0x80) {
        portInfo += ` | Out: ${outputUni}`;
      }
      log(portInfo);
    }
  }

  // Node report (status message)
  if (device.nodeReport) {
    log(`  Status:      ${colors.gray}${device.nodeReport}${colors.reset}`);
  }

  // Status flags
  const statusFlags: string[] = [];
  if (device.status1 & 0x01) statusFlags.push('UBEA present');
  if (device.status1 & 0x02) statusFlags.push('RDM capable');
  if (device.status1 & 0x04) statusFlags.push('ROM boot');

  if (statusFlags.length > 0) {
    log(`  Flags:       ${statusFlags.join(', ')}`);
  }
}

/**
 * Handle an incoming packet
 */
function handlePacket(msg: Buffer, rinfo: dgram.RemoteInfo): void {
  const packet = parsePacket(msg);

  if (!packet || packet.opCode !== OpCode.ArtPollReply) {
    return;
  }

  const reply = parseArtPollReply(msg);
  if (!reply) return;

  // Use the IP from the packet content, not the sender IP
  // (they might differ if going through a router)
  const key = reply.ipAddress;

  if (!discoveredDevices.has(key)) {
    discoveredDevices.set(key, reply);
    log(`  Found: ${reply.shortName} at ${reply.ipAddress}`, colors.green);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║        Art-Net Device Discovery            ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  log(`Broadcast address: ${config.network.broadcast}`, colors.gray);
  log(`Art-Net port: ${config.artnet.port}`, colors.gray);
  log(`Timeout: ${DISCOVERY_TIMEOUT / 1000} seconds`, colors.gray);
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);

  // Create UDP socket
  const socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
  });

  // Handle incoming packets
  socket.on('message', handlePacket);

  // Handle errors
  socket.on('error', (err) => {
    log(`Socket error: ${err.message}`, colors.red);
    socket.close();
    process.exit(1);
  });

  // Bind and enable broadcast
  await new Promise<void>((resolve, reject) => {
    socket.bind(config.artnet.port, () => {
      socket.setBroadcast(true);
      resolve();
    });
    socket.on('error', reject);
  });

  log('Sending ArtPoll broadcast...', colors.yellow);
  console.log('');

  // Create and send ArtPoll packet
  const artPoll = createArtPoll();
  socket.send(artPoll, config.artnet.port, config.network.broadcast, (err) => {
    if (err) {
      log(`Failed to send ArtPoll: ${err.message}`, colors.red);
      socket.close();
      process.exit(1);
    }
    log('  ArtPoll sent, waiting for replies...', colors.gray);
  });

  // Wait for responses
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, DISCOVERY_TIMEOUT);
  });

  // Display results
  console.log('');
  log('═══════════════════════════════════════════════', colors.cyan);

  if (discoveredDevices.size === 0) {
    log('No Art-Net devices discovered.', colors.yellow);
    console.log('');
    log('Troubleshooting:', colors.yellow);
    log('  1. Check that you are on the Art-Net network');
    log('  2. Verify your IP is in the 2.x.x.x range');
    log('  3. Ensure the GrandMA2 is powered on and outputting Art-Net');
    log('  4. Check that no firewall is blocking UDP port 6454');
    log('  5. Try running the sniffer (npm run sniff) to see if any Art-Net traffic exists');
  } else {
    log(`Discovered ${discoveredDevices.size} device(s):`, colors.bold + colors.green);

    const devices = Array.from(discoveredDevices.values());
    devices.forEach((device, index) => {
      displayDevice(device, index);
    });
  }

  console.log('');
  log('═══════════════════════════════════════════════', colors.cyan);
  console.log('');

  socket.close();
  process.exit(discoveredDevices.size > 0 ? 0 : 1);
}

// Run
main().catch((error) => {
  log(`Error: ${error}`, colors.red);
  process.exit(1);
});
