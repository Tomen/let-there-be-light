#!/usr/bin/env node
/**
 * Search for a patch table mapping fixture IDs to DMX addresses
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm find-patch-table <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Known fixture indices from analysis
  const fixtureIndices = [6, 10, 12, 14, 16, 18, 20, 28, 48, 50, 52];

  console.log('Searching for patch table patterns...\n');
  console.log('Known fixture indices:', fixtureIndices.join(', '));
  console.log('');

  // Strategy 1: Search for consecutive fixture IDs as 32-bit values
  console.log('=== Strategy 1: Consecutive fixture IDs (32-bit) ===\n');

  for (let i = 0; i < buffer.length - 24; i++) {
    const val1 = buffer.readUInt32LE(i);
    const val2 = buffer.readUInt32LE(i + 4);
    const val3 = buffer.readUInt32LE(i + 8);

    // Look for ascending small numbers that match fixture indices
    if (fixtureIndices.includes(val1) && fixtureIndices.includes(val2) && val2 > val1) {
      // Check the next values too
      const val4 = buffer.readUInt32LE(i + 12);
      const val5 = buffer.readUInt32LE(i + 16);

      console.log(`  Found at 0x${i.toString(16)}: ${val1}, ${val2}, ${val3}, ${val4}, ${val5}`);

      // Dump the context
      dumpHex(buffer, i, 48);
      console.log('');
    }
  }

  // Strategy 2: Search for fixture index followed by small values (universe 0-7, address 1-512)
  console.log('\n=== Strategy 2: Fixture ID + Universe/Address pattern ===\n');

  const patterns: Array<{offset: number; id: number; potential: string}> = [];

  for (let i = 0; i < buffer.length - 8; i++) {
    const id = buffer.readUInt16LE(i);

    if (!fixtureIndices.includes(id)) continue;

    // Check next 6 bytes for potential universe/address
    const next = buffer.subarray(i + 2, i + 8);

    // Pattern A: ID(16) + Universe(8) + 0 + Address(16) + 0
    const patternA_univ = next[0];
    const patternA_addr = next.readUInt16LE(2);
    if (patternA_univ <= 7 && patternA_addr >= 1 && patternA_addr <= 512 && next[1] === 0) {
      patterns.push({
        offset: i,
        id,
        potential: `Pattern A: U${patternA_univ} A${patternA_addr}`
      });
    }

    // Pattern B: ID(16) + 0 + 0 + Universe(8) + Address(16)
    const patternB_univ = next[2];
    const patternB_addr = next.readUInt16LE(3);
    if (patternB_univ <= 7 && patternB_addr >= 1 && patternB_addr <= 512 && next[0] === 0 && next[1] === 0) {
      patterns.push({
        offset: i,
        id,
        potential: `Pattern B: U${patternB_univ} A${patternB_addr}`
      });
    }
  }

  // Show unique patterns grouped by offset range
  const byRange = new Map<number, typeof patterns>();
  for (const p of patterns) {
    const range = Math.floor(p.offset / 0x10000) * 0x10000;
    if (!byRange.has(range)) byRange.set(range, []);
    byRange.get(range)!.push(p);
  }

  for (const [range, items] of byRange) {
    if (items.length >= 3) {
      console.log(`  Range 0x${range.toString(16)}:`);
      for (const item of items.slice(0, 10)) {
        console.log(`    0x${item.offset.toString(16)}: ID ${item.id} → ${item.potential}`);
      }
      if (items.length > 10) {
        console.log(`    ... and ${items.length - 10} more`);
      }
      console.log('');
    }
  }

  // Strategy 3: Look for "Patch" or "DMXAddress" strings
  console.log('\n=== Strategy 3: Search for patch-related strings ===\n');

  const searchTerms = ['patch', 'dmx', 'address', 'universe', 'channel', 'output', 'univ'];

  for (let i = 0; i < buffer.length - 20; i++) {
    // Check for readable string at this position
    let str = '';
    for (let j = 0; j < 20; j++) {
      const c = buffer[i + j];
      if (c >= 32 && c < 127) {
        str += String.fromCharCode(c);
      } else if (c === 0 && str.length >= 4) {
        break;
      } else {
        str = '';
        break;
      }
    }

    if (str.length >= 4) {
      const lower = str.toLowerCase();
      for (const term of searchTerms) {
        if (lower.includes(term) && !lower.includes('http') && !lower.includes('.dll')) {
          // Check if not in fixture type library area (0x970000+)
          if (i < 0x900000) {
            console.log(`  0x${i.toString(16)}: "${str}"`);
            // Dump context
            dumpHex(buffer, Math.max(0, i - 16), 64);
            console.log('');
            break;
          }
        }
      }
    }
  }

  // Strategy 4: Look at show index pointers
  console.log('\n=== Strategy 4: Analyze show index pointers ===\n');

  // The show name "hillsong_september14" is at 0x2550
  // Check pointers in that area
  const reader = new BinaryReader(buffer, 0x2560);

  console.log('  Analyzing pointers near show name (0x2560+):\n');
  for (let j = 0; j < 20; j++) {
    const pos = reader.position;
    const val = reader.readUInt32LE();

    if (val > 0x8000 && val < buffer.length) {
      // This looks like a valid pointer
      const targetStr = extractString(buffer, val, 30);
      console.log(`    0x${pos.toString(16)}: ptr 0x${val.toString(16)} → "${targetStr}"`);
    } else if (val > 0 && val < 0x1000) {
      console.log(`    0x${pos.toString(16)}: small value ${val}`);
    }
  }
}

function extractString(buffer: Buffer, offset: number, maxLen: number): string {
  let str = '';
  for (let i = 0; i < maxLen && offset + i < buffer.length; i++) {
    const c = buffer[offset + i];
    if (c === 0) break;
    if (c >= 32 && c < 127) {
      str += String.fromCharCode(c);
    } else {
      str += '.';
    }
  }
  return str;
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

    console.log(`      0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
