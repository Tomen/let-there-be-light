#!/usr/bin/env node
/**
 * Analyze patched fixture records at 0xbc0000+
 * These contain actual fixture names like "Spot MH5 Stage 10"
 */
import { loadShowFile } from '../binary/decompressor.js';

interface PatchedFixture {
  offset: number;
  nameOffset: number;
  name: string;
  nameLen: number;
  // Fields before name
  before: number[];
  // Fields after name
  after: number[];
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-patched-fixtures <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Search for fixture-like names in the 0xbc0000+ region
  const fixtures: PatchedFixture[] = [];
  const startOffset = 0xbc0000;
  const endOffset = Math.min(buffer.length, 0xc00000);

  // Search for common patterns: "Spot", "Par", "Wash", "Stage", "Moving"
  const patterns = ['Spot ', 'Par ', 'Wash ', 'Stage ', 'Moving ', 'Partyraum', 'Niesche'];

  for (let i = startOffset; i < endOffset - 50; i++) {
    // Check for name length prefix (u32)
    const nameLen = buffer.readUInt32LE(i);
    if (nameLen >= 5 && nameLen <= 40) {
      // Read potential name
      let name = '';
      let valid = true;
      for (let j = 0; j < nameLen && i + 4 + j < buffer.length; j++) {
        const c = buffer[i + 4 + j];
        if (c >= 32 && c < 127) {
          name += String.fromCharCode(c);
        } else if (c === 0 && j >= 3) {
          break;
        } else {
          valid = false;
          break;
        }
      }

      if (valid && name.length >= 5) {
        // Check if this matches a pattern
        const isMatch = patterns.some(p => name.includes(p));
        if (isMatch) {
          // Found a fixture name
          const before: number[] = [];
          const after: number[] = [];

          // Read 32-bit values before
          for (let j = 32; j >= 4; j -= 4) {
            if (i - j >= 0) {
              before.push(buffer.readUInt32LE(i - j));
            }
          }

          // Read 32-bit values after name
          const afterStart = i + 4 + nameLen;
          for (let j = 0; j < 32 && afterStart + j + 4 <= buffer.length; j += 4) {
            after.push(buffer.readUInt32LE(afterStart + j));
          }

          fixtures.push({
            offset: i,
            nameOffset: i + 4,
            name,
            nameLen,
            before,
            after,
          });
        }
      }
    }
  }

  console.log(`Found ${fixtures.length} patched fixtures\n`);

  // Show first 40 fixtures
  console.log('=== First 40 patched fixtures ===\n');
  console.log('Offset     | Name                      | Before values');
  console.log('-----------|---------------------------|-----------------');

  for (const f of fixtures.slice(0, 40)) {
    const paddedName = f.name.padEnd(25).slice(0, 25);
    const beforeStr = f.before.map(v => v.toString(16).padStart(8, '0')).join(' ');
    console.log(`0x${f.offset.toString(16).padStart(6, '0')} | ${paddedName} | ${beforeStr.slice(0, 50)}`);
  }

  // Look for patterns in the "before" values
  console.log('\n\n=== Analyzing before values ===\n');

  // Check each position in "before" for patterns
  const fieldPositions = [0, 1, 2, 3, 4, 5, 6, 7]; // 8 u32 positions
  for (const pos of fieldPositions) {
    const values = fixtures.map(f => f.before[pos]).filter(v => v !== undefined);
    if (values.length === 0) continue;

    const unique = [...new Set(values)].sort((a, b) => a - b);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check for small values that could be universe/address
    const smallValues = values.filter(v => v > 0 && v < 512);
    const consecutiveCheck = values.map((v, i) => i === 0 ? 0 : v - values[i - 1]);

    console.log(`Field ${pos} (offset -${(8 - pos) * 4}):`);
    console.log(`  Range: ${min} to ${max} (0x${min.toString(16)} to 0x${max.toString(16)})`);
    console.log(`  Unique values: ${unique.length}`);
    console.log(`  First 10: [${values.slice(0, 10).map(v => v.toString(16)).join(', ')}]`);

    if (smallValues.length > 10 && smallValues.length === values.length) {
      console.log(`  *** ALL VALUES < 512 - POSSIBLE DMX/UNIVERSE ***`);
    }
    console.log('');
  }

  // Look for pairs that could be (universe, address)
  console.log('\n=== Looking for universe/address pairs ===\n');

  for (const f of fixtures.slice(0, 20)) {
    // Check all before values for potential universe (0-3) and address (1-512)
    const potentialUniverses = f.before.filter(v => v >= 0 && v <= 3);
    const potentialAddresses = f.before.filter(v => v >= 1 && v <= 512);

    console.log(`${f.name}:`);
    console.log(`  Before: [${f.before.map(v => v.toString(16)).join(', ')}]`);
    console.log(`  Potential universes: [${potentialUniverses.join(', ')}]`);
    console.log(`  Potential addresses: [${potentialAddresses.map(v => `${v} (0x${v.toString(16)})`).join(', ')}]`);
    console.log('');
  }

  // Also check the record structure by looking at repeating patterns
  console.log('\n=== Record structure analysis ===\n');

  // Calculate distances between consecutive fixtures
  const distances: number[] = [];
  for (let i = 1; i < fixtures.length && i < 50; i++) {
    distances.push(fixtures[i].offset - fixtures[i - 1].offset);
  }

  const uniqueDistances = [...new Set(distances)].sort((a, b) => a - b);
  console.log(`Distances between fixtures: [${uniqueDistances.join(', ')}]`);
  console.log(`Most common: ${mode(distances)}`);

  // Dump hex around first few fixtures for detailed analysis
  console.log('\n\n=== Detailed hex dump of first 3 fixtures ===\n');

  for (const f of fixtures.slice(0, 3)) {
    console.log(`\n--- ${f.name} at 0x${f.offset.toString(16)} ---\n`);
    dumpHex(buffer, f.offset - 64, 128);
  }
}

function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let maxCount = 0;
  let maxValue = 0;
  for (const [v, c] of counts) {
    if (c > maxCount) {
      maxCount = c;
      maxValue = v;
    }
  }
  return maxValue;
}

function dumpHex(buffer: Buffer, offset: number, length: number) {
  const start = Math.max(0, offset);
  const end = Math.min(buffer.length, offset + length);

  for (let i = start; i < end; i += 16) {
    const hex: string[] = [];
    const ascii: string[] = [];

    for (let j = 0; j < 16 && i + j < end; j++) {
      const b = buffer[i + j];
      hex.push(b.toString(16).padStart(2, '0'));
      ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
    }

    console.log(`  0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
