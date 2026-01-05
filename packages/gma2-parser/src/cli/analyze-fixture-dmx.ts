#!/usr/bin/env node
/**
 * Analyze fixture records to find DMX address encoding
 *
 * We found fixtures at offsets like 0x27215 (Moving 1)
 * The record structure has a fixture marker at offset -28
 * Let's analyze if DMX info is encoded in the record or linked list
 */
import { loadShowFile } from '../binary/decompressor.js';

const FIXTURE_MARKER = 0x5883b93e;  // Little-endian 0x3eb98358

interface FixtureRecord {
  nameOffset: number;
  name: string;
  markerOffset: number;
  linkedListPtr: number;
  fixtureIndex: number;
  unknown36: number;
  unknown20: number;
  unknown12: number;
  unknown8: number;
  nameLen: number;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-fixture-dmx <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find fixture markers (LE: 3e b9 83 58)
  const fixtures: FixtureRecord[] = [];

  for (let i = 0; i < buffer.length - 64; i++) {
    if (buffer[i] === 0x3e && buffer[i+1] === 0xb9 &&
        buffer[i+2] === 0x83 && buffer[i+3] === 0x58) {

      // Found marker, parse record
      const markerOffset = i;
      const nameOffset = i + 28; // Name is at +28 from marker

      // Read name
      let name = '';
      for (let j = 0; j < 64 && nameOffset + j < buffer.length; j++) {
        const c = buffer[nameOffset + j];
        if (c === 0) break;
        if (c >= 32 && c < 127) {
          name += String.fromCharCode(c);
        }
      }

      if (name.length < 2 || name.length > 40) continue;
      if (!/^[A-Za-z]/.test(name)) continue;

      // Parse fields relative to marker
      const linkedListPtr = markerOffset >= 44 ? buffer.readUInt32LE(markerOffset - 44) : 0;
      const fixtureIndex = markerOffset >= 40 ? buffer.readUInt32LE(markerOffset - 40) : 0;
      const unknown36 = markerOffset >= 36 ? buffer.readUInt32LE(markerOffset - 36) : 0;
      const unknown20 = buffer.readUInt32LE(markerOffset + 4);  // After marker
      const unknown12 = markerOffset >= 12 ? buffer.readUInt32LE(markerOffset - 12) : 0;
      const unknown8 = markerOffset >= 8 ? buffer.readUInt32LE(markerOffset - 8) : 0;
      const nameLen = buffer.readUInt32LE(markerOffset + 24);

      fixtures.push({
        nameOffset,
        name,
        markerOffset,
        linkedListPtr,
        fixtureIndex,
        unknown36,
        unknown20,
        unknown12,
        unknown8,
        nameLen,
      });
    }
  }

  console.log(`Found ${fixtures.length} fixtures\n`);

  // Sort by marker offset
  fixtures.sort((a, b) => a.markerOffset - b.markerOffset);

  // Show first 30 fixtures
  console.log('=== First 30 fixtures ===\n');
  console.log('Name                    | MarkerOff | Index      | LinkedPtr  | Unk36      |');
  console.log('------------------------|-----------|------------|------------|------------|');

  for (const f of fixtures.slice(0, 30)) {
    const paddedName = f.name.padEnd(23).slice(0, 23);
    const marker = f.markerOffset.toString(16).padStart(8, '0');
    const idx = f.fixtureIndex.toString(16).padStart(10, '0');
    const ptr = f.linkedListPtr.toString(16).padStart(10, '0');
    const u36 = f.unknown36.toString(16).padStart(10, '0');

    console.log(`${paddedName} | 0x${marker} | 0x${idx} | 0x${ptr} | 0x${u36} |`);
  }

  // Analyze the fixture index field
  console.log('\n\n=== Fixture Index Analysis ===\n');

  const indexValues = fixtures.map(f => f.fixtureIndex);
  const uniqueIndices = [...new Set(indexValues)].sort((a, b) => a - b);

  console.log(`Total fixtures: ${fixtures.length}`);
  console.log(`Unique index values: ${uniqueIndices.length}`);
  console.log(`Index range: 0x${Math.min(...indexValues).toString(16)} to 0x${Math.max(...indexValues).toString(16)}`);

  // The fixtureIndex field might encode universe + address
  // e.g., 0x10000002 could be: universe in high bytes, address in low bytes
  console.log('\nBreaking down index values:');
  for (const f of fixtures.slice(0, 20)) {
    const high = (f.fixtureIndex >> 16) & 0xFFFF;
    const low = f.fixtureIndex & 0xFFFF;
    const byte3 = (f.fixtureIndex >> 24) & 0xFF;
    const byte2 = (f.fixtureIndex >> 16) & 0xFF;
    const byte1 = (f.fixtureIndex >> 8) & 0xFF;
    const byte0 = f.fixtureIndex & 0xFF;

    console.log(`  ${f.name}: 0x${f.fixtureIndex.toString(16)} = high=${high}, low=${low} | bytes=[${byte3}, ${byte2}, ${byte1}, ${byte0}]`);
  }

  // Check if linked list pointers form a chain
  console.log('\n\n=== Linked List Analysis ===\n');

  const ptrToFixture = new Map<number, FixtureRecord>();
  for (const f of fixtures) {
    ptrToFixture.set(f.markerOffset - 44, f);  // The ptr points to start of record, not marker
  }

  // Follow the chain from first fixture
  console.log('Following linked list from first fixture:');
  let current = fixtures[0];
  for (let i = 0; i < 20 && current; i++) {
    console.log(`  ${i}: ${current.name} @ 0x${current.markerOffset.toString(16)}, next=0x${current.linkedListPtr.toString(16)}`);

    // Try to find next fixture
    const nextPtr = current.linkedListPtr;
    current = fixtures.find(f => f.markerOffset - 44 === nextPtr || f.markerOffset === nextPtr)!;
  }

  // Look for fixtures with specific name patterns and compare their indices
  console.log('\n\n=== Fixtures with numbered names ===\n');

  const numberedFixtures = fixtures
    .filter(f => /\d+$/.test(f.name))
    .sort((a, b) => {
      const numA = parseInt(a.name.match(/(\d+)$/)?.[1] || '0');
      const numB = parseInt(b.name.match(/(\d+)$/)?.[1] || '0');
      return numA - numB;
    });

  console.log('Fixture Name            | Marker    | Index bytes [3,2,1,0] | Low word |');
  console.log('------------------------|-----------|----------------------|----------|');

  for (const f of numberedFixtures.slice(0, 40)) {
    const b3 = (f.fixtureIndex >> 24) & 0xFF;
    const b2 = (f.fixtureIndex >> 16) & 0xFF;
    const b1 = (f.fixtureIndex >> 8) & 0xFF;
    const b0 = f.fixtureIndex & 0xFF;
    const low = f.fixtureIndex & 0xFFFF;

    const paddedName = f.name.padEnd(23).slice(0, 23);
    console.log(`${paddedName} | 0x${f.markerOffset.toString(16).padStart(6, '0')} | [${b3.toString().padStart(3)},${b2.toString().padStart(3)},${b1.toString().padStart(3)},${b0.toString().padStart(3)}] | ${low.toString().padStart(8)} |`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
