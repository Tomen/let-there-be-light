#!/usr/bin/env tsx
/**
 * Tool 1: Connectivity Test
 *
 * Pings the GrandMA2 console to verify basic network connectivity.
 * This is the first step in diagnosing Art-Net issues.
 *
 * Usage: npm run ping
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config.js';

const execAsync = promisify(exec);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Detect the operating system and return the appropriate ping command
 */
function getPingCommand(host: string, count: number = 4): string {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows: -n for count
    return `ping -n ${count} ${host}`;
  } else {
    // Linux/macOS: -c for count
    return `ping -c ${count} ${host}`;
  }
}

/**
 * Parse ping output to extract results
 */
interface PingResult {
  success: boolean;
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: number;
  avgLatency: number | null;
  rawOutput: string;
}

function parsePingOutput(output: string, isWindows: boolean): PingResult {
  const lines = output.split('\n');

  // Default values
  let packetsTransmitted = 0;
  let packetsReceived = 0;
  let packetLoss = 100;
  let avgLatency: number | null = null;

  if (isWindows) {
    // Windows format: "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)"
    const packetLine = lines.find((l) => l.includes('Packets:'));
    if (packetLine) {
      const sentMatch = packetLine.match(/Sent = (\d+)/);
      const recvMatch = packetLine.match(/Received = (\d+)/);
      const lossMatch = packetLine.match(/\((\d+)% loss\)/);

      if (sentMatch) packetsTransmitted = parseInt(sentMatch[1], 10);
      if (recvMatch) packetsReceived = parseInt(recvMatch[1], 10);
      if (lossMatch) packetLoss = parseInt(lossMatch[1], 10);
    }

    // Windows latency: "Average = 1ms"
    const avgLine = lines.find((l) => l.includes('Average'));
    if (avgLine) {
      const avgMatch = avgLine.match(/Average = (\d+)ms/);
      if (avgMatch) avgLatency = parseInt(avgMatch[1], 10);
    }
  } else {
    // Unix format: "4 packets transmitted, 4 received, 0% packet loss"
    const statsLine = lines.find((l) => l.includes('packets transmitted'));
    if (statsLine) {
      const match = statsLine.match(/(\d+) packets transmitted, (\d+) (?:packets )?received, (\d+(?:\.\d+)?)% packet loss/);
      if (match) {
        packetsTransmitted = parseInt(match[1], 10);
        packetsReceived = parseInt(match[2], 10);
        packetLoss = parseFloat(match[3]);
      }
    }

    // Unix latency: "rtt min/avg/max/mdev = 0.123/0.456/0.789/0.111 ms"
    const rttLine = lines.find((l) => l.includes('rtt') || l.includes('round-trip'));
    if (rttLine) {
      const avgMatch = rttLine.match(/[\d.]+\/([\d.]+)\/[\d.]+/);
      if (avgMatch) avgLatency = parseFloat(avgMatch[1]);
    }
  }

  return {
    success: packetsReceived > 0,
    packetsTransmitted,
    packetsReceived,
    packetLoss,
    avgLatency,
    rawOutput: output,
  };
}

/**
 * Ping a host and return the results
 */
async function ping(host: string): Promise<PingResult> {
  const isWindows = process.platform === 'win32';
  const command = getPingCommand(host);

  log(`Executing: ${command}`, colors.cyan);
  console.log('');

  try {
    const { stdout, stderr } = await execAsync(command);
    const output = stdout + stderr;
    return parsePingOutput(output, isWindows);
  } catch (error: unknown) {
    // Ping command returns non-zero exit code if host is unreachable
    // but we still want to parse the output
    if (error && typeof error === 'object' && 'stdout' in error) {
      const execError = error as { stdout: string; stderr: string };
      const output = execError.stdout + execError.stderr;
      return parsePingOutput(output, isWindows);
    }

    return {
      success: false,
      packetsTransmitted: 0,
      packetsReceived: 0,
      packetLoss: 100,
      avgLatency: null,
      rawOutput: String(error),
    };
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('');
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║     Art-Net Connectivity Test              ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  console.log('');

  log(`Your IP: ${config.network.myIp}`, colors.yellow);
  log(`Target:  ${config.network.grandma2Primary} (GrandMA2 Primary)`, colors.yellow);
  console.log('');

  // Run ping test
  const result = await ping(config.network.grandma2Primary);

  // Display results
  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);
  log('Results:', colors.bold);
  console.log('');

  if (result.success) {
    log('  ✓ PASS - Host is reachable', colors.green + colors.bold);
  } else {
    log('  ✗ FAIL - Host is unreachable', colors.red + colors.bold);
  }

  console.log('');
  log(`  Packets: ${result.packetsReceived}/${result.packetsTransmitted} received`);
  log(`  Loss:    ${result.packetLoss}%`);

  if (result.avgLatency !== null) {
    log(`  Latency: ${result.avgLatency}ms average`);
  }

  console.log('');
  log('─────────────────────────────────────────────', colors.cyan);

  // Print troubleshooting tips if failed
  if (!result.success) {
    console.log('');
    log('Troubleshooting:', colors.yellow);
    log('  1. Check that you are connected to the Art-Net network');
    log('  2. Verify your IP is set to ' + config.network.myIp);
    log('  3. Check the subnet mask is ' + config.network.subnet);
    log('  4. Ensure the GrandMA2 is powered on');
    log('  5. Verify no firewall is blocking ICMP');
    console.log('');
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run
main().catch((error) => {
  log(`Error: ${error}`, colors.red);
  process.exit(1);
});
