#!/usr/bin/env node
/**
 * Dump fixture records in detail to find where DMX info might be stored
 */
import { loadShowFile } from '../binary/decompressor.js';
import { scanForStrings } from '../binary/record-parser.js';

const FIXTURE_MARKER = 0x3eb98358;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm dump-fixture-records <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find all fixture markers
  const fixtureOffsets: number[] = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer.readUInt32LE(i) === FIXTURE_MARKER) {
      fixtureOffsets.push(i);
    }
  }

  console.log(`Found ${fixtureOffsets.length} fixture markers\n`);

  // Sort by offset
  fixtureOffsets.sort((a, b) => a - b);

  // Dump the first 10 fixtures in detail
  console.log('=== First 10 fixtures ===\n');

  for (let i = 0; i < Math.min(10, fixtureOffsets.length); i++) {
    const offset = fixtureOffsets[i];

    // Try to read the fixture name (usually at offset +28)
    let name = '';
    for (let j = 28; j < 60; j++) {
      const nameOffset = offset + j;
      if (nameOffset < buffer.length) {
        const char = buffer[nameOffset];
        if (char === 0) break;
        if (char >= 32 && char < 127) {
          name += String.fromCharCode(char);
        }
      }
    }

    console.log(`\n--- Fixture ${i + 1}: "${name}" at 0x${offset.toString(16)} ---`);

    // Dump 128 bytes before and after the marker
    console.log('\nBefore marker (-64 bytes):');
    dumpHex(buffer, Math.max(0, offset - 64), 64);

    console.log('\nMarker and after (+128 bytes):');
    dumpHex(buffer, offset, 128);

    // Try to parse the fixture record
    console.log('\nParsing record fields:');

    // Fields before the marker (at negative offsets from marker)
    if (offset >= 44) {
      const linkedListPtr = buffer.readUInt32LE(offset - 44);
      const fixtureIndex = buffer.readUInt32LE(offset - 40);
      const unknown1 = buffer.readUInt32LE(offset - 36);
      const unknown2 = buffer.readUInt32LE(offset - 32);

      console.log(`  Linked list ptr: 0x${linkedListPtr.toString(16)}`);
      console.log(`  Fixture index: 0x${fixtureIndex.toString(16)} (${fixtureIndex & 0xFFFF})`);
      console.log(`  Unknown1 at -36: 0x${unknown1.toString(16)}`);
      console.log(`  Unknown2 at -32: 0x${unknown2.toString(16)}`);
    }

    // Fields after the marker
    const afterMarker = offset + 4;
    if (afterMarker + 40 < buffer.length) {
      // Usually: 4 bytes ?, 4 bytes ?, then name at +28

      for (let fieldOffset = 0; fieldOffset < 28; fieldOffset += 4) {
        const val = buffer.readUInt32LE(afterMarker + fieldOffset);
        console.log(`  +${4 + fieldOffset}: 0x${val.toString(16)} (${val})`);
      }
    }
  }

  // Look for patterns across all fixtures
  console.log('\n\n=== Analyzing patterns across all fixtures ===\n');

  // Collect values from specific offsets to see if any look like DMX addresses
  const valuesAtOffset: Map<number, number[]> = new Map();

  for (const offset of fixtureOffsets.slice(0, 100)) {
    for (let fieldOffset = -64; fieldOffset < 128; fieldOffset += 4) {
      const absOffset = offset + fieldOffset;
      if (absOffset >= 0 && absOffset + 4 <= buffer.length) {
        const val = buffer.readUInt32LE(absOffset);

        if (!valuesAtOffset.has(fieldOffset)) {
          valuesAtOffset.set(fieldOffset, []);
        }
        valuesAtOffset.get(fieldOffset)!.push(val);
      }
    }
  }

  // Find offsets where values look like DMX addresses (1-512, mostly unique)
  console.log('Offsets with values that could be DMX addresses:');

  for (const [fieldOffset, values] of valuesAtOffset) {
    const inRange = values.filter(v => v >= 1 && v <= 512);
    const unique = new Set(inRange);

    if (inRange.length > 50 && unique.size > inRange.length * 0.7) {
      console.log(`\n  Offset ${fieldOffset}: ${inRange.length}/${values.length} values in 1-512 range`);
      console.log(`    First 20: [${values.slice(0, 20).join(', ')}]`);

      // Check if sequential or 3-spaced
      const sorted = [...inRange].sort((a, b) => a - b);
      console.log(`    Sorted first 20: [${sorted.slice(0, 20).join(', ')}]`);
    }
  }

  // Also check 16-bit values
  console.log('\n\nChecking 16-bit values at each offset:');

  const values16AtOffset: Map<number, number[]> = new Map();

  for (const offset of fixtureOffsets.slice(0, 100)) {
    for (let fieldOffset = -64; fieldOffset < 128; fieldOffset += 2) {
      const absOffset = offset + fieldOffset;
      if (absOffset >= 0 && absOffset + 2 <= buffer.length) {
        const val = buffer.readUInt16LE(absOffset);

        if (!values16AtOffset.has(fieldOffset)) {
          values16AtOffset.set(fieldOffset, []);
        }
        values16AtOffset.get(fieldOffset)!.push(val);
      }
    }
  }

  for (const [fieldOffset, values] of values16AtOffset) {
    const inRange = values.filter(v => v >= 1 && v <= 512);
    const unique = new Set(inRange);

    if (inRange.length > 50 && unique.size > inRange.length * 0.5) {
      console.log(`\n  Offset ${fieldOffset} (16-bit): ${inRange.length}/${values.length} values in 1-512 range`);
      console.log(`    First 20: [${values.slice(0, 20).join(', ')}]`);
    }
  }

  // Look specifically for universe values (0-3)
  console.log('\n\nChecking for universe values (0-3) at each byte offset:');

  const universeOffsets: Map<number, number[]> = new Map();

  for (const offset of fixtureOffsets.slice(0, 100)) {
    for (let fieldOffset = -64; fieldOffset < 128; fieldOffset++) {
      const absOffset = offset + fieldOffset;
      if (absOffset >= 0 && absOffset < buffer.length) {
        const val = buffer[absOffset];

        if (!universeOffsets.has(fieldOffset)) {
          universeOffsets.set(fieldOffset, []);
        }
        universeOffsets.get(fieldOffset)!.push(val);
      }
    }
  }

  for (const [fieldOffset, values] of universeOffsets) {
    const inRange = values.filter(v => v >= 0 && v <= 3);
    const zeros = values.filter(v => v === 0).length;
    const ones = values.filter(v => v === 1).length;
    const twos = values.filter(v => v === 2).length;
    const threes = values.filter(v => v === 3).length;

    // Look for offsets where we have a mix of 0-3 values (not all zeros)
    if (inRange.length === values.length && zeros < values.length * 0.9 && values.length > 50) {
      console.log(`\n  Offset ${fieldOffset}: 0=${zeros}, 1=${ones}, 2=${twos}, 3=${threes}`);
      console.log(`    First 20: [${values.slice(0, 20).join(', ')}]`);
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
