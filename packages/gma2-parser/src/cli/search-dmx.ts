#!/usr/bin/env node
/**
 * Search for DMX address patterns in GMA2 show files
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';
import { scanForStrings } from '../binary/record-parser.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-dmx <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Strategy 1: Look for "Universe" or "Univ" strings
  console.log('=== Searching for Universe-related strings ===');
  const strings = scanForStrings(buffer, 4, 64);
  const universeStrings = strings.filter(s =>
    s.value.toLowerCase().includes('univ') ||
    s.value.toLowerCase().includes('dmx') ||
    s.value.toLowerCase().includes('patch') ||
    s.value.toLowerCase().includes('address')
  );

  for (const s of universeStrings.slice(0, 20)) {
    console.log(`0x${s.offset.toString(16).padStart(8, '0')}: "${s.value}"`);
  }

  // Strategy 2: Look near known fixture names for DMX-like values
  console.log('\n=== Searching near fixture names ===');
  const fixtureNames = ['Moving 1', 'Moving 2', 'Moving 3', 'Moving 4', 'Blinder', 'Strobe'];

  for (const name of fixtureNames) {
    const nameBytes = Buffer.from(name, 'utf8');

    // Search for the fixture name
    for (let i = 0; i < buffer.length - nameBytes.length - 100; i++) {
      let match = true;
      for (let j = 0; j < nameBytes.length; j++) {
        if (buffer[i + j] !== nameBytes[j]) {
          match = false;
          break;
        }
      }

      if (match && buffer[i + nameBytes.length] === 0) { // Null-terminated
        console.log(`\n${name} found at 0x${i.toString(16)}:`);

        // Look at extended context for DMX addresses
        const contextStart = Math.max(0, i - 128);
        const contextEnd = Math.min(buffer.length, i + nameBytes.length + 128);

        // Search for small values (1-512) that could be DMX addresses
        const reader = new BinaryReader(buffer, contextStart);
        const potentialAddrs: Array<{offset: number, value: number}> = [];

        while (reader.position < contextEnd - 2) {
          const pos = reader.position;
          const val16 = reader.peekBytes(2);
          const le16 = val16[0] | (val16[1] << 8);

          // Look for values in DMX range (1-512)
          if (le16 >= 1 && le16 <= 512) {
            potentialAddrs.push({ offset: pos, value: le16 });
          }
          reader.skip(1);
        }

        // Show potential addresses
        const nearName = potentialAddrs.filter(a =>
          Math.abs(a.offset - i) < 64
        );

        for (const addr of nearName) {
          const relOffset = addr.offset - i;
          console.log(`  Offset ${relOffset >= 0 ? '+' : ''}${relOffset}: ${addr.value}`);
        }

        // Only show first match per fixture
        break;
      }
    }
  }

  // Strategy 3: Look for sequential fixture IDs with addresses
  console.log('\n=== Searching for patch table patterns ===');
  // A patch table might have: fixture_id (4 bytes), universe (2 bytes), address (2 bytes)
  // Look for patterns of (id, small, small) repeating

  let patchCandidates = 0;
  for (let i = 0; i < buffer.length - 32; i += 4) {
    const id1 = buffer.readUInt32LE(i);
    const val1 = buffer.readUInt16LE(i + 4);
    const val2 = buffer.readUInt16LE(i + 6);

    const id2 = buffer.readUInt32LE(i + 8);
    const val3 = buffer.readUInt16LE(i + 12);
    const val4 = buffer.readUInt16LE(i + 14);

    // Check for sequential IDs with small values
    if (id1 > 0 && id1 < 100 && id2 === id1 + 1 &&
        val1 < 16 && val2 >= 1 && val2 <= 512 &&
        val3 < 16 && val4 >= 1 && val4 <= 512) {

      console.log(`Potential patch table at 0x${i.toString(16)}:`);
      console.log(`  Fixture ${id1}: Universe ${val1}, Address ${val2}`);
      console.log(`  Fixture ${id2}: Universe ${val3}, Address ${val4}`);

      // Show more entries
      for (let j = 2; j < 5; j++) {
        const offset = i + j * 8;
        if (offset + 8 <= buffer.length) {
          const id = buffer.readUInt32LE(offset);
          const univ = buffer.readUInt16LE(offset + 4);
          const addr = buffer.readUInt16LE(offset + 6);
          if (id === id1 + j && univ < 16 && addr >= 1 && addr <= 512) {
            console.log(`  Fixture ${id}: Universe ${univ}, Address ${addr}`);
          }
        }
      }

      patchCandidates++;
      if (patchCandidates >= 5) break;
    }
  }

  // Strategy 4: Look for "Fixture" string followed by numbers
  console.log('\n=== Searching for Fixture definitions ===');
  const fixtureRefs = strings.filter(s =>
    s.value.startsWith('Fixture') ||
    s.value.includes('.Fixture') ||
    s.value.match(/^[A-Z][a-z]+\s+\d+$/) // Like "Moving 1"
  );

  for (const f of fixtureRefs.slice(0, 30)) {
    console.log(`0x${f.offset.toString(16).padStart(8, '0')}: "${f.value}"`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
