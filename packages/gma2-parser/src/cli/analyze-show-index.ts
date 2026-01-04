#!/usr/bin/env node
/**
 * Analyze the show index structure to find where show data actually lives
 */
import { loadShowFile } from '../binary/decompressor.js';
import { scanForStrings } from '../binary/record-parser.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-show-index <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find show names
  const showNames = [
    'hillsong wien basic april 2022',
    'hillsong wien - 2025-05',
  ];

  for (const name of showNames) {
    console.log(`\n=== "${name}" ===\n`);

    // Find the string
    const nameBytes = Buffer.from(name, 'utf-8');
    let offset = -1;

    for (let i = 0; i < buffer.length - nameBytes.length; i++) {
      if (buffer.slice(i, i + nameBytes.length).equals(nameBytes)) {
        offset = i;
        break;
      }
    }

    if (offset === -1) {
      console.log('Not found!');
      continue;
    }

    console.log(`Found at offset 0x${offset.toString(16)}`);

    // Dump context around the string (before and after)
    console.log('\nContext before string (-64 bytes):');
    dumpHex(buffer, Math.max(0, offset - 64), 64);

    console.log('\nThe string and after (+128 bytes):');
    dumpHex(buffer, offset, 128);

    // Look for potential pointers/offsets in the surrounding data
    console.log('\n32-bit values near the string:');
    for (let i = offset - 64; i < offset + 64; i += 4) {
      if (i < 0 || i >= buffer.length - 4) continue;
      const val = buffer.readUInt32LE(i);
      // Look for values that could be offsets into the file
      if (val > 0x1000 && val < buffer.length) {
        console.log(`  0x${i.toString(16)}: 0x${val.toString(16)} (${(val / 1024 / 1024).toFixed(2)} MB) - possible offset`);
      }
    }
  }

  // Now look for show-level data by searching for structures that reference show names
  console.log('\n\n=== Searching for show data pointers ===\n');

  // The show names are at ~0x21bc and ~0x238d
  // Look for 32-bit values that point to these offsets
  const showNameOffsets = [0x21bc, 0x238d];

  for (const nameOffset of showNameOffsets) {
    console.log(`\nLooking for pointers to 0x${nameOffset.toString(16)}:`);
    let found = 0;
    for (let i = 0; i < buffer.length - 4; i += 4) {
      const val = buffer.readUInt32LE(i);
      if (val === nameOffset) {
        console.log(`  Found at 0x${i.toString(16)}`);
        dumpHex(buffer, Math.max(0, i - 16), 48);
        found++;
        if (found >= 5) break;
      }
    }
    if (found === 0) {
      console.log('  None found - names might be inline, not referenced by pointer');
    }
  }

  // Look for a show table/index structure
  console.log('\n\n=== Looking for show index table ===\n');

  // The shows appear to be listed sequentially around 0x2000
  // Let's analyze this section more carefully
  const indexStart = 0x2000;
  const indexEnd = 0x2800;

  console.log(`Analyzing region 0x${indexStart.toString(16)} - 0x${indexEnd.toString(16)}:`);
  dumpHex(buffer, indexStart, indexEnd - indexStart);

  // Look for repeating record patterns
  console.log('\n\nLooking for repeating record patterns...');

  // Find all strings in the index region
  const strings = scanForStrings(buffer.slice(indexStart, indexEnd), 4, 64);
  console.log('\nStrings in index region:');
  for (const s of strings) {
    console.log(`  0x${(indexStart + s.offset).toString(16)}: "${s.value}"`);
  }

  // Calculate spacing between show names
  const hillsongStrings = strings.filter(s =>
    s.value.includes('hillsong') || s.value.includes('showfile')
  );

  console.log('\nShow name spacing:');
  for (let i = 1; i < hillsongStrings.length; i++) {
    const spacing = hillsongStrings[i].offset - hillsongStrings[i - 1].offset;
    console.log(`  ${hillsongStrings[i-1].value} -> ${hillsongStrings[i].value}: ${spacing} bytes (0x${spacing.toString(16)})`);
  }

  // Now the key insight: these are probably just show names in a list
  // The actual show DATA is elsewhere. Let's find the main data sections.
  console.log('\n\n=== Finding major data sections ===\n');

  // Look for large blocks of similar data types
  // DMX/patch data would be lots of small integers

  // Scan file in 64KB chunks and characterize each
  const chunkSize = 0x10000; // 64KB
  const chunks: Array<{
    offset: number;
    smallInts: number;  // Count of bytes < 20
    zeros: number;
    ascii: number;
    pattern: string;
  }> = [];

  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
    let smallInts = 0;
    let zeros = 0;
    let ascii = 0;

    for (const b of chunk) {
      if (b === 0) zeros++;
      else if (b <= 20) smallInts++;
      else if (b >= 32 && b < 127) ascii++;
    }

    const pattern =
      zeros > chunk.length * 0.5 ? 'mostly-zeros' :
      ascii > chunk.length * 0.3 ? 'text-heavy' :
      smallInts > chunk.length * 0.3 ? 'small-ints' :
      'mixed';

    chunks.push({ offset: i, smallInts, zeros, ascii, pattern });
  }

  // Show interesting chunks
  console.log('Chunks with high small-integer density (potential DMX data):');
  const dmxCandidates = chunks.filter(c => c.smallInts > chunkSize * 0.2 && c.pattern !== 'mostly-zeros');
  for (const c of dmxCandidates.slice(0, 10)) {
    console.log(`  0x${c.offset.toString(16)}: ${c.smallInts} small ints, ${c.zeros} zeros, pattern: ${c.pattern}`);
  }

  // Investigate the first candidate
  if (dmxCandidates.length > 0) {
    const candidate = dmxCandidates[0];
    console.log(`\nInvestigating 0x${candidate.offset.toString(16)}:`);
    dumpHex(buffer, candidate.offset, 256);

    // Look for sequential patterns
    console.log('\nSearching for sequential address patterns...');
    for (let recordSize = 1; recordSize <= 8; recordSize++) {
      for (let startOffset = candidate.offset; startOffset < candidate.offset + 1000; startOffset++) {
        let sequential = true;
        const first = buffer[startOffset];
        if (first < 1 || first > 10) continue;

        for (let j = 1; j < 10; j++) {
          const val = buffer[startOffset + j * recordSize];
          if (val !== first + j) {
            sequential = false;
            break;
          }
        }

        if (sequential) {
          console.log(`  Record size ${recordSize} at 0x${startOffset.toString(16)}: starts with ${first}`);
          dumpHex(buffer, startOffset, 32);
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
