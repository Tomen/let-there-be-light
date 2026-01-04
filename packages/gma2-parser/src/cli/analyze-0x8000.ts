#!/usr/bin/env node
/**
 * Analyze the promising region at 0x8000 which shows repeating records
 * with what might be universe (02) and incrementing indices
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-0x8000 <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Dump region around 0x8000
  console.log('=== Region 0x7f00 - 0x8200 ===\n');
  dumpHex(buffer, 0x7f00, 0x300);

  // Try to parse as records
  console.log('\n\n=== Attempting to parse as fixed-size records ===\n');

  // Try different record sizes
  for (let recordSize of [16, 20, 24, 28, 32]) {
    console.log(`\n--- Record size ${recordSize} starting at 0x8000 ---`);

    const records: Array<{
      offset: number;
      bytes: number[];
      u16s: number[];
      u32s: number[];
    }> = [];

    for (let i = 0; i < 10; i++) {
      const offset = 0x8000 + i * recordSize;
      const bytes: number[] = [];
      const u16s: number[] = [];
      const u32s: number[] = [];

      for (let j = 0; j < recordSize; j++) {
        bytes.push(buffer[offset + j]);
      }
      for (let j = 0; j < recordSize; j += 2) {
        u16s.push(buffer.readUInt16LE(offset + j));
      }
      for (let j = 0; j < recordSize; j += 4) {
        u32s.push(buffer.readUInt32LE(offset + j));
      }

      records.push({ offset, bytes, u16s, u32s });

      // Check if records look similar (have repeating structure)
      console.log(`  Record ${i}: u32s=[${u32s.join(', ')}]`);
    }

    // Check for repeating patterns
    const firstU32s = records.map(r => r.u32s[0]);
    const allSame = firstU32s.every(v => v === firstU32s[0]);
    if (allSame) {
      console.log(`  -> First u32 is constant: ${firstU32s[0]}`);
    }
  }

  // Look for universe values (0, 1, 2, 3) with nearby channel/address values
  console.log('\n\n=== Looking for universe markers with nearby addresses ===\n');

  // Based on the dump, at 0x8000 we have:
  // 64 00 18 00 00 00 00 00 00 00 02 00 00 00 01 00
  // This could be: some_header, universe=2, address=1

  // Let me try to find the structure by looking at what's consistent
  // across multiple records

  const startOffset = 0x8000;
  const scanLength = 0x400; // Scan 1KB

  // Look for patterns where:
  // - Some bytes are constant
  // - One field increments (could be fixture ID or address)
  // - One field could be universe (0-3)

  for (let recordSize = 16; recordSize <= 32; recordSize += 4) {
    const fieldPatterns: Map<number, number[]> = new Map();

    for (let i = 0; i < 20; i++) {
      const offset = startOffset + i * recordSize;
      if (offset + recordSize > buffer.length) break;

      for (let field = 0; field < recordSize; field += 4) {
        const val = buffer.readUInt32LE(offset + field);
        if (!fieldPatterns.has(field)) {
          fieldPatterns.set(field, []);
        }
        fieldPatterns.get(field)!.push(val);
      }
    }

    // Analyze each field
    let hasSequential = false;
    let hasUniverse = false;

    for (const [fieldOffset, values] of fieldPatterns) {
      const unique = [...new Set(values)];
      const isSequential = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
      const is3Spaced = values.every((v, i) => i === 0 || v === values[i - 1] + 3);
      const isUniverse = values.every(v => v >= 0 && v <= 3);

      if (isSequential && values[0] >= 1 && values[0] <= 10) {
        console.log(`  Record size ${recordSize}, field +${fieldOffset}: SEQUENTIAL starting at ${values[0]}`);
        hasSequential = true;
      }
      if (is3Spaced && values[0] >= 1 && values[0] <= 10) {
        console.log(`  Record size ${recordSize}, field +${fieldOffset}: 3-SPACED starting at ${values[0]}`);
        hasSequential = true;
      }
      if (isUniverse && unique.length < 4) {
        console.log(`  Record size ${recordSize}, field +${fieldOffset}: Could be UNIVERSE (values: ${unique.join(', ')})`);
        hasUniverse = true;
      }
    }

    if (hasSequential && hasUniverse) {
      console.log(`  *** PROMISING STRUCTURE at record size ${recordSize} ***`);
    }
  }

  // Now let's specifically look at what appears to be a patch table pattern
  console.log('\n\n=== Detailed analysis of 0x8000 structure ===\n');

  // Parse assuming 28-byte records based on the hex dump pattern
  const recordSize = 28;
  console.log(`Assuming ${recordSize}-byte records:`);

  for (let i = 0; i < 20; i++) {
    const offset = 0x8000 + i * recordSize;

    // Parse fields
    const field0 = buffer.readUInt16LE(offset);      // Always 100?
    const field1 = buffer.readUInt16LE(offset + 2);  // Always 24?
    const field2 = buffer.readUInt32LE(offset + 4);  // zeros
    const field3 = buffer.readUInt32LE(offset + 8);  // Could be universe?
    const field4 = buffer.readUInt32LE(offset + 12); // Could be fixture/address?
    const field5 = buffer.readUInt32LE(offset + 16);
    const field6 = buffer.readUInt32LE(offset + 20);
    const field7 = buffer.readUInt32LE(offset + 24);

    console.log(`${i}: f0=${field0}, f1=${field1}, f2=${field2}, f3=${field3}, f4=${field4}, f5=${field5}, f6=${field6}`);
  }

  // Also check if there's a header before 0x8000 that tells us the count
  console.log('\n\nPossible header at 0x7ff0:');
  dumpHex(buffer, 0x7ff0, 32);
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
