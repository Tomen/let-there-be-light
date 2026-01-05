#!/usr/bin/env node
/**
 * Search exhaustively for the exact DMX pattern:
 * - 100 fixtures sequential (1, 2, 3, 4...)
 * - 100 fixtures 3-ch spacing (1, 4, 7, 10...)
 *
 * Try various encodings and record structures
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm find-dmx-pattern <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('=== Strategy 1: Look for fixture count markers (100, 200, or similar) ===\n');

  // Look for 100 or 0x64 as a count field, followed by data
  const countMarkers: Array<{ offset: number; count: number; format: string }> = [];

  for (let i = 0; i < buffer.length - 8; i++) {
    // 32-bit count = 100
    const v32 = buffer.readUInt32LE(i);
    if (v32 === 100) {
      // Check what follows - could be array of fixture data
      const next = buffer.slice(i + 4, i + 20);
      // If followed by small values, might be start of array
      if (next[0] <= 10 || next[0] === 0) {
        countMarkers.push({ offset: i, count: 100, format: 'u32' });
      }
    }

    // 16-bit count = 100
    const v16 = buffer.readUInt16LE(i);
    if (v16 === 100 && buffer.readUInt16LE(i + 2) < 10) {
      countMarkers.push({ offset: i, count: 100, format: 'u16' });
    }
  }

  console.log(`Found ${countMarkers.length} potential count=100 markers`);
  for (const m of countMarkers.slice(0, 20)) {
    console.log(`\n0x${m.offset.toString(16)} (${m.format}):`);
    dumpHex(buffer, m.offset, 48);
  }

  console.log('\n\n=== Strategy 2: Look for universe identifiers followed by address data ===\n');

  // Universe could be stored as 0, 1, 2 (0-indexed) or 1, 2, 3 (1-indexed)
  // Look for patterns like: universe, padding, address, channel_count

  interface UniverseMatch {
    offset: number;
    universe: number;
    possibleAddresses: number[];
  }

  const universeMatches: UniverseMatch[] = [];

  for (let i = 0; i < buffer.length - 32; i++) {
    // Look for universe 1 (0 or 1) followed by address data
    const b0 = buffer[i];
    const b1 = buffer[i + 1];

    // Pattern: universe byte = 0 or 1, followed by zeros, then addresses
    if ((b0 === 0 || b0 === 1) && b1 === 0) {
      // Check next several bytes for sequential small numbers
      const next = buffer.slice(i + 2, i + 32);
      const possibleAddrs: number[] = [];

      // Try 8-bit addresses
      for (let j = 0; j < 20; j++) {
        if (next[j] >= 1 && next[j] <= 200) {
          possibleAddrs.push(next[j]);
        } else if (next[j] === 0 && possibleAddrs.length > 0) {
          // Could be padding
        } else {
          break;
        }
      }

      // If we found sequential addresses
      if (possibleAddrs.length >= 5) {
        const isSequential = possibleAddrs.every((v, idx, arr) =>
          idx === 0 || v === arr[idx - 1] + 1 || v === arr[idx - 1] + 3
        );

        if (isSequential && possibleAddrs[0] <= 10) {
          universeMatches.push({
            offset: i,
            universe: b0,
            possibleAddresses: possibleAddrs
          });
        }
      }
    }
  }

  console.log(`Found ${universeMatches.length} potential universe+address patterns`);
  for (const m of universeMatches.slice(0, 10)) {
    console.log(`\n0x${m.offset.toString(16)}: Universe ${m.universe}, addresses: [${m.possibleAddresses.slice(0, 10).join(', ')}...]`);
    dumpHex(buffer, m.offset, 48);
  }

  console.log('\n\n=== Strategy 3: Look for pairs of (index, address) ===\n');

  // Fixtures might be stored as (fixture_index, dmx_address) pairs
  // Look for sequences like: (1, 1), (2, 2), (3, 3)... or (1, 1), (2, 4), (3, 7)...

  for (let recordSize = 4; recordSize <= 16; recordSize += 2) {
    const pairMatches: number[] = [];

    for (let i = 0; i < buffer.length - recordSize * 10; i++) {
      let valid = true;
      let isSequentialAddr = true;
      let is3ChAddr = true;

      for (let j = 0; j < 10; j++) {
        const idx = buffer.readUInt16LE(i + j * recordSize);
        const addr = buffer.readUInt16LE(i + j * recordSize + 2);

        // Fixture index should be sequential 1, 2, 3... or 0, 1, 2...
        if (idx !== j + 1 && idx !== j) {
          valid = false;
          break;
        }

        // Address should be sequential or 3-ch spaced
        if (addr !== j + 1) isSequentialAddr = false;
        if (addr !== j * 3 + 1) is3ChAddr = false;
      }

      if (valid && (isSequentialAddr || is3ChAddr)) {
        pairMatches.push(i);
        if (pairMatches.length >= 5) break;
      }
    }

    if (pairMatches.length > 0) {
      console.log(`Record size ${recordSize}: found ${pairMatches.length} (index, address) pairs`);
      for (const offset of pairMatches.slice(0, 3)) {
        console.log(`\n0x${offset.toString(16)}:`);
        dumpHex(buffer, offset, 64);
      }
    }
  }

  console.log('\n\n=== Strategy 4: Search around known fixture marker locations ===\n');

  // We know fixtures are stored with marker 0x3eb98358
  // The DMX patch might be in a separate table that references fixture IDs

  const FIXTURE_MARKER = 0x3eb98358;
  const fixtureOffsets: number[] = [];

  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer.readUInt32LE(i) === FIXTURE_MARKER) {
      fixtureOffsets.push(i);
    }
  }

  console.log(`Found ${fixtureOffsets.length} fixtures total`);

  if (fixtureOffsets.length > 0) {
    // Look at the first fixture
    const first = fixtureOffsets[0];
    console.log(`\nFirst fixture at 0x${first.toString(16)}:`);
    dumpHex(buffer, first - 64, 128);

    // Look for a common offset that all fixtures might reference
    // (like a global patch table offset)
    console.log('\nLooking for common values near fixture markers...');

    const commonValues = new Map<number, number>();
    for (const offset of fixtureOffsets.slice(0, 50)) {
      for (let j = -32; j < 64; j += 4) {
        const val = buffer.readUInt32LE(offset + j);
        if (val > 0x1000 && val < buffer.length && val !== FIXTURE_MARKER) {
          commonValues.set(val, (commonValues.get(val) || 0) + 1);
        }
      }
    }

    // Sort by frequency
    const sorted = [...commonValues.entries()].sort((a, b) => b[1] - a[1]);
    console.log('\nMost common offset-like values near fixtures:');
    for (const [val, count] of sorted.slice(0, 10)) {
      console.log(`  0x${val.toString(16)} (${(val/1024).toFixed(1)} KB): appears ${count} times`);
    }

    // Check the most common ones
    for (const [val] of sorted.slice(0, 3)) {
      console.log(`\nData at 0x${val.toString(16)}:`);
      dumpHex(buffer, val, 64);
    }
  }

  console.log('\n\n=== Strategy 5: Look for "Patch" or "DMX" strings ===\n');

  // Search for patch-related strings
  const patchKeywords = ['Patch', 'patch', 'DMX', 'dmx', 'Address', 'address', 'Universe', 'universe', 'Channel', 'channel'];

  for (const keyword of patchKeywords) {
    const keywordBytes = Buffer.from(keyword);
    const matches: number[] = [];

    for (let i = 0; i < buffer.length - keyword.length; i++) {
      if (buffer.slice(i, i + keyword.length).equals(keywordBytes)) {
        matches.push(i);
      }
    }

    if (matches.length > 0 && matches.length < 50) {
      console.log(`"${keyword}": found at ${matches.length} locations`);
      for (const offset of matches.slice(0, 5)) {
        console.log(`\n0x${offset.toString(16)}:`);
        dumpHex(buffer, Math.max(0, offset - 16), 64);
      }
    } else if (matches.length >= 50) {
      console.log(`"${keyword}": found ${matches.length} times (too many to show)`);
    }
  }

  console.log('\n\n=== Strategy 6: Look for fixture type + patch assignment structure ===\n');

  // Patch might be: [fixture_type_id (2 bytes), fixture_instance (2 bytes), universe (1 byte), address (2 bytes), channel_count (1 byte)]
  // Let's look for repeated 8-byte records

  for (let recordSize = 6; recordSize <= 12; recordSize++) {
    const tables: Array<{ offset: number; entries: Array<{ universe: number; address: number }> }> = [];

    for (let i = 0; i < buffer.length - recordSize * 100; i++) {
      const entries: Array<{ universe: number; address: number }> = [];
      let valid = true;

      for (let j = 0; j < 100; j++) {
        const recordStart = i + j * recordSize;

        // Try to find universe (0-4) and address (1-512) in various positions
        for (let uPos = 0; uPos < recordSize - 2; uPos++) {
          const u = buffer[recordStart + uPos];
          if (u > 4) continue;

          for (let aPos = uPos + 1; aPos < recordSize - 1; aPos++) {
            const a = buffer.readUInt16LE(recordStart + aPos);
            if (a < 1 || a > 512) continue;

            // Check if this address fits the expected pattern
            const expectedSeq = j + 1;
            const expected3Ch = j * 3 + 1;

            if (a === expectedSeq || a === expected3Ch) {
              entries.push({ universe: u, address: a });
              break;
            }
          }
        }

        if (entries.length !== j + 1) {
          valid = false;
          break;
        }
      }

      if (valid && entries.length >= 50) {
        tables.push({ offset: i, entries: entries.slice(0, 10) });
        if (tables.length >= 3) break;
      }
    }

    if (tables.length > 0) {
      console.log(`Record size ${recordSize}: found ${tables.length} potential patch tables`);
      for (const t of tables) {
        console.log(`\n0x${t.offset.toString(16)}:`);
        console.log(`First 10 entries: ${t.entries.map(e => `U${e.universe}:${e.address}`).join(', ')}`);
        dumpHex(buffer, t.offset, 64);
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
