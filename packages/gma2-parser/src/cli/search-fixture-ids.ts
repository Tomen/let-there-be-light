#!/usr/bin/env node
/**
 * Search for fixture IDs that encode universe+channel
 * e.g., Universe 3 Channel 1 = ID 2001 (universe 0-indexed: 2*1000 + 1)
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-fixture-ids <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Possible ID encoding schemes:
  // 1. ID = universe * 1000 + channel (0-indexed universe)
  //    U1 = 0*1000+1..100 = 1..100
  //    U3 = 2*1000+1,4,7.. = 2001, 2004, 2007...
  //
  // 2. ID = universe * 1000 + channel (1-indexed universe)
  //    U1 = 1*1000+1..100 = 1001..1100
  //    U3 = 3*1000+1,4,7.. = 3001, 3004, 3007...

  console.log('=== Searching for ID sequences ===\n');

  // Search for sequence starting with 2001, 2004, 2007, 2010 (U3 0-indexed)
  console.log('Looking for 2001, 2004, 2007, 2010... (U3 with 3-ch spacing, 0-indexed):');
  findSequence32(buffer, [2001, 2004, 2007, 2010, 2013, 2016]);

  // Search for 3001, 3004, 3007 (U3 1-indexed)
  console.log('\nLooking for 3001, 3004, 3007, 3010... (U3 with 3-ch spacing, 1-indexed):');
  findSequence32(buffer, [3001, 3004, 3007, 3010, 3013, 3016]);

  // Search for 1, 2, 3, 4, 5 (U1 simple)
  console.log('\nLooking for 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (U1 simple):');
  findSequence32(buffer, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Search for 1001, 1002, 1003 (U1 with 1000 offset)
  console.log('\nLooking for 1001, 1002, 1003, 1004, 1005... (U1 with 1000 offset):');
  findSequence32(buffer, [1001, 1002, 1003, 1004, 1005, 1006]);

  // Search for 1, 1002, 1003 in 16-bit
  console.log('\nLooking for 16-bit sequences:');
  findSequence16(buffer, [2001, 2004, 2007, 2010]);
  findSequence16(buffer, [1001, 1002, 1003, 1004]);

  // Also look for patterns where universe and channel are separate bytes
  // e.g., [universe, 0, channel_lo, channel_hi] or similar
  console.log('\n\n=== Looking for (universe, channel) struct patterns ===\n');

  // Pattern: [2 bytes universe][2 bytes channel] where universe=2, channel=1,4,7,10...
  findUniverseChannelPairs(buffer);

  // Search for the value 2001 anywhere (as a starting point)
  console.log('\n\n=== All occurrences of value 2001 ===\n');
  const value = 2001;
  let count = 0;
  for (let i = 0; i < buffer.length - 4; i += 2) {
    const v16 = buffer.readUInt16LE(i);
    const v32 = buffer.readUInt32LE(i);

    if (v16 === value || v32 === value) {
      count++;
      if (count <= 20) {
        console.log(`0x${i.toString(16)}: 16-bit=${v16}, 32-bit=${v32}`);
        dumpHex(buffer, i, 32);
      }
    }
  }
  console.log(`Total occurrences: ${count}`);

  // Look for structured patch table with many fixture IDs
  console.log('\n\n=== Looking for fixture ID tables (values in 1-10000 range) ===\n');

  // Find regions with lots of values in the 1-10000 range
  const chunkSize = 0x1000;
  const goodChunks: Array<{ offset: number; count: number; sample: number[] }> = [];

  for (let i = 0; i < buffer.length - chunkSize; i += chunkSize) {
    const values: number[] = [];
    for (let j = 0; j < chunkSize; j += 4) {
      const v = buffer.readUInt32LE(i + j);
      if (v >= 1 && v <= 10000) {
        values.push(v);
      }
    }

    if (values.length > 100) {
      goodChunks.push({ offset: i, count: values.length, sample: values.slice(0, 20) });
    }
  }

  console.log(`Found ${goodChunks.length} chunks with many fixture-ID-like values`);
  for (const chunk of goodChunks.slice(0, 10)) {
    console.log(`\n0x${chunk.offset.toString(16)}: ${chunk.count} values`);
    console.log(`  Sample: [${chunk.sample.join(', ')}]`);

    // Check for patterns
    const sorted = [...new Set(chunk.sample)].sort((a, b) => a - b);
    console.log(`  Unique sorted: [${sorted.slice(0, 15).join(', ')}...]`);

    dumpHex(buffer, chunk.offset, 64);
  }
}

function findSequence32(buffer: Buffer, sequence: number[]) {
  const matches: number[] = [];

  for (let i = 0; i < buffer.length - sequence.length * 4; i += 4) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      const val = buffer.readUInt32LE(i + j * 4);
      if (val !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  console.log(`  Found ${matches.length} matches`);
  for (const offset of matches.slice(0, 5)) {
    console.log(`  0x${offset.toString(16)}:`);
    dumpHex(buffer, offset, 48);
  }
}

function findSequence16(buffer: Buffer, sequence: number[]) {
  const matches: number[] = [];

  for (let i = 0; i < buffer.length - sequence.length * 2; i += 2) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      const val = buffer.readUInt16LE(i + j * 2);
      if (val !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  console.log(`  16-bit [${sequence.slice(0, 4).join(', ')}...]: ${matches.length} matches`);
  for (const offset of matches.slice(0, 3)) {
    console.log(`  0x${offset.toString(16)}:`);
    dumpHex(buffer, offset, 32);
  }
}

function findUniverseChannelPairs(buffer: Buffer) {
  // Look for: universe=2 (for U3), followed by channels 1, 4, 7, 10...
  const matches: number[] = [];

  for (let recordSize = 4; recordSize <= 8; recordSize += 2) {
    for (let i = 0; i < buffer.length - recordSize * 20; i++) {
      let valid = true;

      for (let j = 0; j < 10; j++) {
        const offset = i + j * recordSize;
        // Try different layouts

        // Layout: [u16 universe][u16 channel]
        const u16 = buffer.readUInt16LE(offset);
        const ch16 = buffer.readUInt16LE(offset + 2);

        const expectedCh = j * 3 + 1;

        if (u16 === 2 && ch16 === expectedCh) {
          // Matches U3 pattern
        } else if (u16 === 0 && ch16 === j + 1) {
          // Matches U1 pattern (0-indexed)
        } else {
          valid = false;
          break;
        }
      }

      if (valid) {
        matches.push(i);
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      console.log(`Record size ${recordSize}: ${matches.length} matches`);
      for (const offset of matches.slice(0, 2)) {
        dumpHex(buffer, offset, 48);
      }
      break;
    }
  }

  if (matches.length === 0) {
    console.log('No (universe, channel) pair patterns found');
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
