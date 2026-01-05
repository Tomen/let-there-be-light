#!/usr/bin/env node
/**
 * Analyze potential patch data near fixture markers
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';
import { FIXTURE_MARKER, scanForFixtures } from '../domain/fixture-extractor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-patch <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find all fixture marker occurrences
  const markers: number[] = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] === 0x3e && buffer[i+1] === 0xb9 &&
        buffer[i+2] === 0x83 && buffer[i+3] === 0x58) {
      markers.push(i);
    }
  }

  console.log(`Found ${markers.length} fixture markers\n`);

  // Analyze the area before each fixture marker
  console.log('=== Analyzing data before fixture markers ===\n');

  for (const markerOffset of markers.slice(0, 30)) {
    // Look for the fixture name (at marker + 28 based on original analysis)
    const nameOffset = markerOffset + 28;
    if (nameOffset + 4 >= buffer.length) continue;

    const nameLen = buffer.readUInt32LE(nameOffset);
    if (nameLen < 1 || nameLen > 64) continue;

    if (nameOffset + 4 + nameLen > buffer.length) continue;
    const name = buffer.subarray(nameOffset + 4, nameOffset + 4 + nameLen).toString('utf8')
      .replace(/[\x00-\x1F\x7F]/g, '').trim();

    if (!name || name.length === 0) continue;

    console.log(`\n=== ${name} (marker at 0x${markerOffset.toString(16)}) ===`);

    // Dump 64 bytes before the marker
    const start = Math.max(0, markerOffset - 64);
    dumpWithAnnotations(buffer, start, markerOffset + 32, markerOffset);

    // Look for potential DMX values in the range before marker
    const reader = new BinaryReader(buffer, markerOffset - 32);
    console.log('\n  Potential patch values (32 bytes before marker):');
    for (let i = 0; i < 8; i++) {
      const val = reader.readUInt32LE();
      const byte0 = val & 0xFF;
      const byte1 = (val >> 8) & 0xFF;
      const byte2 = (val >> 16) & 0xFF;
      const byte3 = (val >> 24) & 0xFF;

      // Check if this could be DMX data (universe 0-15, address 1-512)
      if (byte0 <= 15 && byte1 === 0 && byte2 >= 1 && byte3 === 0) {
        console.log(`    +${i*4}: Universe ${byte0}, Address ${byte2} (0x${val.toString(16).padStart(8, '0')})`);
      } else if (byte2 <= 15 && byte3 === 0 && val < 0x10000 && val > 0) {
        // Or maybe it's different encoding
        console.log(`    +${i*4}: 0x${val.toString(16).padStart(8, '0')} = ${val}`);
      }
    }
  }

  // Now let's look for linked list pointers and fixture IDs
  console.log('\n\n=== Looking for fixture ID → patch mapping ===\n');

  // Get actual fixtures
  const fixtures = scanForFixtures(buffer);
  console.log(`Found ${fixtures.length} fixtures by name scan\n`);

  // Check what's at offset -36 (fixture index) and -44 (next pointer)
  for (const f of fixtures.slice(0, 10)) {
    const markerPos = f.offset - 28; // marker is at -28 from name

    // At -36 from name we should find fixture index
    const indexField = f.offset - 36;
    if (indexField < 0) continue;

    const indexValue = buffer.readUInt32LE(indexField);
    const fixtureIndex = (indexValue >> 24) & 0xFF;
    const lowBytes = indexValue & 0xFFFFFF;

    // At -44 from name we should find next pointer
    const nextPtrField = f.offset - 44;
    const nextPtr = nextPtrField >= 0 ? buffer.readUInt32LE(nextPtrField) : 0;

    console.log(`${f.name}:`);
    console.log(`  Index field (offset ${indexField.toString(16)}): 0x${indexValue.toString(16).padStart(8, '0')}`);
    console.log(`    → Fixture Index: ${fixtureIndex}, Low bytes: 0x${lowBytes.toString(16)}`);
    console.log(`  Next pointer: 0x${nextPtr.toString(16)}`);

    // Look for DMX address - check various offsets before the fixture
    console.log(`  Scanning for DMX values before fixture...`);

    for (let offset = 48; offset <= 128; offset += 4) {
      const checkPos = f.offset - offset;
      if (checkPos < 0) break;

      const val = buffer.readUInt32LE(checkPos);
      const byte0 = val & 0xFF;
      const byte1 = (val >> 8) & 0xFF;
      const byte2 = (val >> 16) & 0xFF;
      const byte3 = (val >> 24) & 0xFF;

      // Looking for pattern: small_universe (0-7), 0, address (1-255)
      if (byte0 <= 7 && byte1 === 0 && byte2 >= 1 && byte2 <= 255 && byte3 === 0) {
        console.log(`    -${offset}: Universe ${byte0}, possibly address ${byte2}`);
      }
    }

    console.log('');
  }
}

function dumpWithAnnotations(buffer: Buffer, start: number, end: number, markerOffset: number) {
  for (let i = start; i < end; i += 16) {
    const hex: string[] = [];
    const ascii: string[] = [];

    for (let j = 0; j < 16 && i + j < end; j++) {
      const b = buffer[i + j];
      hex.push(b.toString(16).padStart(2, '0'));
      ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
    }

    const rel = i - markerOffset;
    const relStr = rel >= 0 ? `+${rel}` : `${rel}`;
    console.log(`  ${relStr.padStart(4)}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
