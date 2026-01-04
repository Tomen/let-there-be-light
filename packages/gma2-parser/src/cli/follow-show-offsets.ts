#!/usr/bin/env node
/**
 * Follow the offset pointers in show index records to find show data
 */
import { loadShowFile } from '../binary/decompressor.js';

interface ShowIndexEntry {
  nameOffset: number;
  name: string;
  offset1: number;  // First 32-bit offset before name
  offset2: number;  // Second 32-bit offset before name
  nameLen: number;  // Length field before name
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm follow-show-offsets <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Parse the show index starting at 0x2000
  // Record structure appears to be:
  //   ... padding ...
  //   03 00 09 03 00 00 00 00   (marker?)
  //   [4 bytes] offset1
  //   [4 bytes] offset2
  //   [4 bytes] name length
  //   [name string...]
  //   [padding to alignment]
  //   02 01 00 00 [4 bytes] next_record_offset?

  const shows: ShowIndexEntry[] = [];

  // Find show entries by searching for the "03 00 09 03" or "41 3c 09 03" marker pattern
  for (let i = 0x2000; i < 0x2600; i++) {
    // Look for pattern followed by show name
    const b0 = buffer[i];
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];
    const b4 = buffer[i + 4];
    const b5 = buffer[i + 5];
    const b6 = buffer[i + 6];
    const b7 = buffer[i + 7];

    // Pattern: XX XX 09 03 00 00 00 00 followed by offset1, offset2, len, name
    if (b2 === 0x09 && b3 === 0x03 && b4 === 0x00 && b5 === 0x00 && b6 === 0x00 && b7 === 0x00) {
      const offset1 = buffer.readUInt32LE(i + 8);
      const offset2 = buffer.readUInt32LE(i + 12);
      const nameLen = buffer.readUInt32LE(i + 16);

      if (nameLen > 0 && nameLen < 64) {
        const name = buffer.slice(i + 20, i + 20 + nameLen).toString('utf-8').replace(/\0/g, '');

        if (name.length > 3 && /^[a-zA-Z0-9]/.test(name)) {
          shows.push({
            nameOffset: i + 20,
            name,
            offset1,
            offset2,
            nameLen
          });
        }
      }
    }
  }

  console.log(`Found ${shows.length} show entries:\n`);

  for (const show of shows) {
    console.log(`=== ${show.name} ===`);
    console.log(`  Name at: 0x${show.nameOffset.toString(16)}`);
    console.log(`  Offset1: 0x${show.offset1.toString(16)} (${(show.offset1 / 1024).toFixed(1)} KB)`);
    console.log(`  Offset2: 0x${show.offset2.toString(16)} (${(show.offset2 / 1024).toFixed(1)} KB)`);
    console.log('');
  }

  // Now follow the offsets for shows we're interested in
  const targetShows = shows.filter(s =>
    s.name.includes('april 2022') ||
    s.name.includes('2025-05') ||
    s.name.includes('2025-03')
  );

  console.log('\n=== Following offsets for target shows ===\n');

  for (const show of targetShows) {
    console.log(`\n--- ${show.name} ---\n`);

    // Follow offset1
    if (show.offset1 > 0 && show.offset1 < buffer.length - 256) {
      console.log(`Data at offset1 (0x${show.offset1.toString(16)}):`);
      dumpHex(buffer, show.offset1, 128);
    }

    // Follow offset2
    if (show.offset2 > 0 && show.offset2 < buffer.length - 256) {
      console.log(`\nData at offset2 (0x${show.offset2.toString(16)}):`);
      dumpHex(buffer, show.offset2, 128);
    }
  }

  // Compare the data at offset1 for 2022 vs 2025-05
  console.log('\n\n=== Comparing offset1 data between 2022 and 2025-05 ===\n');

  const show2022 = targetShows.find(s => s.name.includes('april 2022'));
  const show2025 = targetShows.find(s => s.name.includes('2025-05'));

  if (show2022 && show2025) {
    console.log(`2022 offset1: 0x${show2022.offset1.toString(16)}`);
    console.log(`2025 offset1: 0x${show2025.offset1.toString(16)}`);

    // Compare structure at each offset
    const range = 0x10000; // 64KB comparison

    // Get data ranges
    const data2022 = buffer.slice(show2022.offset1, show2022.offset1 + range);
    const data2025 = buffer.slice(show2025.offset1, show2025.offset1 + range);

    // Find first difference
    let firstDiff = -1;
    for (let i = 0; i < Math.min(data2022.length, data2025.length); i++) {
      if (data2022[i] !== data2025[i]) {
        firstDiff = i;
        break;
      }
    }

    if (firstDiff >= 0) {
      console.log(`\nFirst difference at relative offset 0x${firstDiff.toString(16)}`);
      console.log('\n2022:');
      dumpHex(buffer, show2022.offset1 + firstDiff, 64);
      console.log('\n2025:');
      dumpHex(buffer, show2025.offset1 + firstDiff, 64);
    } else {
      console.log('\nData is identical for first 64KB!');
    }

    // Count total differences
    let diffCount = 0;
    const diffBlocks: number[] = [];
    for (let i = 0; i < Math.min(data2022.length, data2025.length); i += 16) {
      let blockDiff = false;
      for (let j = 0; j < 16 && i + j < data2022.length; j++) {
        if (data2022[i + j] !== data2025[i + j]) {
          blockDiff = true;
          diffCount++;
        }
      }
      if (blockDiff) {
        diffBlocks.push(i);
      }
    }

    console.log(`\nTotal differing bytes in first 64KB: ${diffCount}`);
    console.log(`Differing 16-byte blocks: ${diffBlocks.length}`);

    // Show sample of differences
    console.log('\nSample differences (first 5 blocks):');
    for (const block of diffBlocks.slice(0, 5)) {
      console.log(`\nRelative offset 0x${block.toString(16)}:`);
      console.log('2022:');
      dumpHex(data2022, block, 16);
      console.log('2025:');
      dumpHex(data2025, block, 16);
    }
  }

  // Also investigate offset2 - appears to be larger, might be main show data
  console.log('\n\n=== Comparing offset2 data (main show data?) ===\n');

  if (show2022 && show2025) {
    // The offset2 values are much larger and closer together
    // 2022: 0x0b4542 (~738 KB)
    // 2025: 0x0b49a3 (~739 KB)

    console.log(`2022 offset2: 0x${show2022.offset2.toString(16)} (${(show2022.offset2/1024).toFixed(1)} KB)`);
    console.log(`2025 offset2: 0x${show2025.offset2.toString(16)} (${(show2025.offset2/1024).toFixed(1)} KB)`);

    // These are very close together (about 1.1KB apart)
    // They might be pointing to the same general area but at different show boundaries

    // Look for patch-related data near these offsets
    for (const show of [show2022, show2025]) {
      console.log(`\n--- ${show.name} at offset2 ---`);

      // Scan for DMX-like patterns near offset2
      const searchStart = Math.max(0, show.offset2 - 0x1000);
      const searchEnd = Math.min(buffer.length, show.offset2 + 0x10000);

      // Look for sequential small numbers that could be DMX addresses
      for (let i = searchStart; i < searchEnd - 20; i++) {
        // Pattern: sequential bytes 1,2,3,4,5... or 1,4,7,10...
        const b = buffer.slice(i, i + 10);

        // Check for 1-channel fixture pattern
        if (b[0] === 1 && b[1] === 2 && b[2] === 3 && b[3] === 4 && b[4] === 5) {
          console.log(`\nSequential 1,2,3,4,5 at 0x${i.toString(16)}:`);
          dumpHex(buffer, i, 32);
        }

        // Check for 3-channel fixture pattern (as 16-bit LE)
        if (i + 12 < buffer.length) {
          const a1 = buffer.readUInt16LE(i);
          const a2 = buffer.readUInt16LE(i + 2);
          const a3 = buffer.readUInt16LE(i + 4);
          const a4 = buffer.readUInt16LE(i + 6);

          if (a1 === 1 && a2 === 4 && a3 === 7 && a4 === 10) {
            console.log(`\nSequential 1,4,7,10 (16-bit) at 0x${i.toString(16)}:`);
            dumpHex(buffer, i, 32);
          }
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
