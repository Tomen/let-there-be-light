#!/usr/bin/env node
/**
 * Decode the 3-channel address table found at 0xc00c89
 * Pattern: 1, 4, 7, 10... with record size 18
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm decode-3ch-table <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Table found at 0xc00c89 with record size 18
  const tableOffset = 0xc00c89;
  const recordSize = 18;

  console.log('=== Hex dump of 3-channel table region ===\n');
  dumpHex(buffer, tableOffset - 32, 256);

  console.log('\n\n=== Decoding records (18-byte each) ===\n');

  for (let i = 0; i < 20; i++) {
    const offset = tableOffset + i * recordSize;
    const bytes = buffer.slice(offset, offset + recordSize);

    // Read as 16-bit values
    const u16s: number[] = [];
    for (let j = 0; j < recordSize; j += 2) {
      u16s.push(buffer.readUInt16LE(offset + j));
    }

    console.log(`Record ${i} @ 0x${offset.toString(16)}:`);
    console.log(`  u16s: [${u16s.join(', ')}]`);
    console.log(`  Hex: ${[...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  }

  // Try to identify the fields
  console.log('\n\n=== Field analysis ===\n');

  const fieldValues: number[][] = Array(9).fill(null).map(() => []);

  for (let i = 0; i < 50; i++) {
    const offset = tableOffset + i * recordSize;
    for (let j = 0; j < 9; j++) {
      fieldValues[j].push(buffer.readUInt16LE(offset + j * 2));
    }
  }

  for (let j = 0; j < 9; j++) {
    const values = fieldValues[j];
    const unique = [...new Set(values)].sort((a, b) => a - b);
    const isSequential = values.every((v, i) => i === 0 || v === values[i-1] + 1);
    const is3Spaced = values.every((v, i) => i === 0 || v === values[i-1] + 3);

    console.log(`Field ${j} (offset +${j * 2}):`);
    console.log(`  Values: [${values.slice(0, 15).join(', ')}...]`);
    console.log(`  Unique: ${unique.length}, Range: ${Math.min(...values)} - ${Math.max(...values)}`);
    if (isSequential) console.log(`  *** SEQUENTIAL (+1)`);
    if (is3Spaced) console.log(`  *** 3-SPACED (+3)`);
    console.log('');
  }

  // Also look at the region before this table for context
  console.log('\n=== Context before table ===\n');
  dumpHex(buffer, tableOffset - 128, 128);

  // Count how many records exist
  console.log('\n\n=== Counting valid records ===\n');

  let recordCount = 0;
  for (let i = 0; i < 200; i++) {
    const offset = tableOffset + i * recordSize;
    if (offset + recordSize > buffer.length) break;

    const firstU16 = buffer.readUInt16LE(offset);
    const expectedAddr = i * 3 + 1;

    // Check if this looks like a valid 3-ch record
    if (firstU16 === expectedAddr) {
      recordCount++;
    } else {
      console.log(`Record ${i}: expected addr ${expectedAddr}, got ${firstU16}`);
      if (recordCount > 0) break;
    }
  }

  console.log(`\nTotal valid 3-ch records: ${recordCount}`);
  console.log(`Address range: 1 to ${(recordCount - 1) * 3 + 1}`);

  // Now look for the Universe 1 table (1, 2, 3, 4...)
  console.log('\n\n=== Looking for Universe 1 table (1, 2, 3, 4...) ===\n');

  // Search with the same record size
  for (let startOffset = 0; startOffset < buffer.length - recordSize * 20; startOffset++) {
    let match = true;
    for (let i = 0; i < 10; i++) {
      const val = buffer.readUInt16LE(startOffset + i * recordSize);
      if (val !== i + 1) {
        match = false;
        break;
      }
    }

    if (match) {
      console.log(`Found 1-ch pattern at 0x${startOffset.toString(16)}:`);
      dumpHex(buffer, startOffset, recordSize * 10);

      // Count records
      let count = 0;
      for (let i = 0; i < 200; i++) {
        const val = buffer.readUInt16LE(startOffset + i * recordSize);
        if (val === i + 1) {
          count++;
        } else {
          break;
        }
      }
      console.log(`Total 1-ch records: ${count}`);
      break;
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
