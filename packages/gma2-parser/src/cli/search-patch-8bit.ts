#!/usr/bin/env node
/**
 * Search for DMX patch data with 8-bit address encoding
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-patch-8bit <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Strategy 1: Look for 8-bit sequential addresses 1,2,3,4,5,6,7,8,9,10
  console.log('=== Strategy 1: Sequential 8-bit addresses (1,2,3,4,5,6,7,8,9,10) ===\n');
  findSequential8(buffer, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

  // Strategy 2: Look for 3-channel spacing (1,4,7,10,13,16) as 8-bit values
  console.log('\n=== Strategy 2: 3-channel spacing 8-bit (1,4,7,10,13,16) ===\n');
  findSequential8(buffer, 1, 4, 7, 10, 13, 16);

  // Strategy 3: Search for longer sequential runs with spacing
  console.log('\n=== Strategy 3: Look for address tables with record structure ===\n');
  findAddressTable(buffer);

  // Strategy 4: Search for universe markers near patches
  console.log('\n=== Strategy 4: Universe byte followed by address range ===\n');
  findUniversePatchPatterns(buffer);
}

function findSequential8(buffer: Buffer, ...sequence: number[]) {
  const matches: number[] = [];

  for (let i = 0; i < buffer.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buffer[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  console.log(`Found ${matches.length} matches for sequence [${sequence.join(', ')}]`);
  for (const offset of matches.slice(0, 15)) {
    console.log(`  0x${offset.toString(16).padStart(8, '0')}`);
    dumpHex(buffer, Math.max(0, offset - 16), 64);
    console.log('');
  }
  if (matches.length > 15) {
    console.log(`  ... and ${matches.length - 15} more`);
  }
}

function findAddressTable(buffer: Buffer) {
  // Look for patterns where addresses increment by 1 or 3 with fixed record size
  // Record could be: [address, ...other_data] repeated

  for (let recordSize = 4; recordSize <= 16; recordSize += 2) {
    const matches: number[] = [];

    for (let i = 0; i < buffer.length - recordSize * 10; i++) {
      // Check for 10 consecutive records with incrementing addresses
      let sequential = true;
      let firstAddr = buffer[i];

      // Skip if first address isn't in valid DMX range
      if (firstAddr < 1 || firstAddr > 100) continue;

      for (let r = 1; r < 10; r++) {
        const addr = buffer[i + r * recordSize];
        // Check for +1 increment (1-channel fixtures)
        if (addr !== firstAddr + r) {
          sequential = false;
          break;
        }
      }

      if (sequential) {
        matches.push(i);
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      console.log(`Record size ${recordSize}: ${matches.length} potential tables`);
      for (const offset of matches.slice(0, 3)) {
        console.log(`  0x${offset.toString(16)}: first addr = ${buffer[offset]}`);
        dumpHex(buffer, offset, recordSize * 10);
        console.log('');
      }
    }
  }

  // Also look for 3-channel increment pattern
  console.log('\nLooking for 3-channel increment (RGB fixtures)...');
  for (let recordSize = 4; recordSize <= 16; recordSize += 2) {
    const matches: number[] = [];

    for (let i = 0; i < buffer.length - recordSize * 10; i++) {
      let sequential = true;
      let firstAddr = buffer[i];

      if (firstAddr < 1 || firstAddr > 50) continue;

      for (let r = 1; r < 10; r++) {
        const addr = buffer[i + r * recordSize];
        // Check for +3 increment (3-channel fixtures)
        if (addr !== firstAddr + r * 3) {
          sequential = false;
          break;
        }
      }

      if (sequential) {
        matches.push(i);
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      console.log(`Record size ${recordSize}: ${matches.length} potential RGB tables`);
      for (const offset of matches.slice(0, 3)) {
        console.log(`  0x${offset.toString(16)}: first addr = ${buffer[offset]}`);
        dumpHex(buffer, offset, recordSize * 10);
        console.log('');
      }
    }
  }
}

function findUniversePatchPatterns(buffer: Buffer) {
  // Look for universe byte (0, 1, 2) followed by many valid addresses

  for (const universe of [0, 1, 2]) {
    console.log(`\nSearching for Universe ${universe} markers...`);

    const matches: Array<{offset: number; addresses: number[]}> = [];

    for (let i = 0; i < buffer.length - 100; i++) {
      if (buffer[i] !== universe) continue;

      // Check if following bytes could be sequential addresses
      const addresses: number[] = [];
      let prevAddr = 0;

      for (let j = 1; j < 50 && i + j * 2 < buffer.length; j++) {
        const addr = buffer[i + j * 2];
        if (addr >= 1 && addr <= 200 && addr > prevAddr) {
          addresses.push(addr);
          prevAddr = addr;
        } else {
          break;
        }
      }

      if (addresses.length >= 10 && addresses[0] >= 1 && addresses[0] <= 10) {
        matches.push({ offset: i, addresses });
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      console.log(`  Found ${matches.length} potential patch areas`);
      for (const m of matches.slice(0, 3)) {
        console.log(`  0x${m.offset.toString(16)}: addresses [${m.addresses.slice(0, 10).join(', ')}...]`);
        dumpHex(buffer, m.offset, 64);
      }
    }
  }
}

function dumpHex(buffer: Buffer, offset: number, length: number) {
  const end = Math.min(buffer.length, offset + length);

  for (let i = offset; i < end; i += 16) {
    const hex: string[] = [];
    const ascii: string[] = [];

    for (let j = 0; j < 16 && i + j < end; j++) {
      const b = buffer[i + j];
      hex.push(b.toString(16).padStart(2, '0'));
      ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
    }

    console.log(`    0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
