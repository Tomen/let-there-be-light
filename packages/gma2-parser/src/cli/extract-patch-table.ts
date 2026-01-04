#!/usr/bin/env node
/**
 * Extract the patch table found at 0x7f00-0x8xxx
 * Record format appears to be 28 bytes:
 * - u16 constant (100)
 * - u16 constant (24)
 * - 6 bytes padding
 * - u32 universe (0, 1, 2 = U1, U2, U3)
 * - u32 index/address
 * - 8 bytes padding
 */
import { loadShowFile } from '../binary/decompressor.js';

interface PatchEntry {
  offset: number;
  universe: number;
  index: number;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm extract-patch-table <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find all records with the 64 00 18 00 header pattern
  const HEADER = Buffer.from([0x64, 0x00, 0x18, 0x00]);
  const RECORD_SIZE = 28;

  const entries: PatchEntry[] = [];

  // Scan for header pattern
  for (let i = 0; i < buffer.length - RECORD_SIZE; i++) {
    if (buffer[i] === 0x64 && buffer[i+1] === 0x00 &&
        buffer[i+2] === 0x18 && buffer[i+3] === 0x00) {

      // Check if rest of record looks valid
      // Bytes 4-9 should be zeros
      let validPadding = true;
      for (let j = 4; j < 10; j++) {
        if (buffer[i + j] !== 0) {
          validPadding = false;
          break;
        }
      }

      if (validPadding) {
        const universe = buffer.readUInt32LE(i + 10);
        const index = buffer.readUInt32LE(i + 14);

        // Universe should be 0-3, index should be reasonable
        if (universe <= 3 && index >= 0 && index <= 600) {
          entries.push({ offset: i, universe, index });
        }
      }
    }
  }

  console.log(`Found ${entries.length} patch-like records\n`);

  // Group by universe
  const byUniverse: Map<number, PatchEntry[]> = new Map();
  for (const e of entries) {
    if (!byUniverse.has(e.universe)) {
      byUniverse.set(e.universe, []);
    }
    byUniverse.get(e.universe)!.push(e);
  }

  console.log('=== Summary by Universe ===\n');
  for (const [u, list] of [...byUniverse.entries()].sort((a, b) => a[0] - b[0])) {
    const indices = list.map(e => e.index).sort((a, b) => a - b);
    const uniqueIndices = [...new Set(indices)];
    console.log(`Universe ${u} (U${u + 1}): ${list.length} entries`);
    console.log(`  Indices: [${uniqueIndices.slice(0, 20).join(', ')}${uniqueIndices.length > 20 ? '...' : ''}]`);
    console.log(`  Range: ${Math.min(...uniqueIndices)} to ${Math.max(...uniqueIndices)}`);

    // Check for patterns
    if (uniqueIndices.length > 5) {
      const diffs = [];
      for (let i = 1; i < Math.min(10, uniqueIndices.length); i++) {
        diffs.push(uniqueIndices[i] - uniqueIndices[i - 1]);
      }
      console.log(`  First differences: [${diffs.join(', ')}]`);
    }
    console.log('');
  }

  // Show first few entries of each universe
  console.log('=== First 10 entries per Universe ===\n');
  for (const [u, list] of [...byUniverse.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`Universe ${u}:`);
    for (const e of list.slice(0, 10)) {
      console.log(`  0x${e.offset.toString(16)}: index=${e.index}`);
    }
    console.log('');
  }

  // Check if there's a different record type with 64 00 00 00 header
  console.log('\n=== Looking for alternative record format (64 00 00 00) ===\n');

  const altEntries: Array<{ offset: number; bytes: number[] }> = [];
  for (let i = 0; i < buffer.length - 28; i++) {
    if (buffer[i] === 0x64 && buffer[i+1] === 0x00 &&
        buffer[i+2] === 0x00 && buffer[i+3] === 0x00) {
      altEntries.push({
        offset: i,
        bytes: [...buffer.slice(i, i + 28)]
      });
    }
  }

  console.log(`Found ${altEntries.length} records with 64 00 00 00 header`);
  for (const e of altEntries.slice(0, 5)) {
    console.log(`\n0x${e.offset.toString(16)}:`);
    dumpHex(buffer, e.offset, 28);
  }

  // Now let's look for where the actual DMX addresses (1, 4, 7, 10...) might be
  console.log('\n\n=== Looking for 3-channel address pattern (1, 4, 7, 10...) ===\n');

  // Search for the sequence [1, 4, 7, 10, 13, 16] in any format
  for (let recordSize = 4; recordSize <= 32; recordSize += 2) {
    const sequence = [1, 4, 7, 10, 13, 16];
    let found = false;

    for (let i = 0; i < buffer.length - recordSize * sequence.length && !found; i++) {
      // Try u32 LE
      let match32 = true;
      for (let j = 0; j < sequence.length; j++) {
        const val = buffer.readUInt32LE(i + j * recordSize);
        if (val !== sequence[j]) {
          match32 = false;
          break;
        }
      }

      if (match32) {
        console.log(`Found 3-ch pattern at 0x${i.toString(16)} with record size ${recordSize} (u32):`);
        dumpHex(buffer, i, recordSize * sequence.length);
        found = true;
      }

      // Try u16 LE
      if (!found) {
        let match16 = true;
        for (let j = 0; j < sequence.length; j++) {
          const val = buffer.readUInt16LE(i + j * recordSize);
          if (val !== sequence[j]) {
            match16 = false;
            break;
          }
        }

        if (match16) {
          console.log(`Found 3-ch pattern at 0x${i.toString(16)} with record size ${recordSize} (u16):`);
          dumpHex(buffer, i, recordSize * sequence.length);
          found = true;
        }
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

    console.log(`  0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
