#!/usr/bin/env node
/**
 * Compare two shows within a GMA2 file to find patch data differences
 *
 * Usage: pnpm compare-shows <file> <show1-name> <show2-name>
 */
import { loadShowFile } from '../binary/decompressor.js';
import { scanForStrings } from '../binary/record-parser.js';

interface ShowBoundary {
  name: string;
  nameOffset: number;
  startOffset: number;
  endOffset: number;
}

async function main() {
  const filePath = process.argv[2];
  const show1Pattern = process.argv[3] || 'april 2022';
  const show2Pattern = process.argv[4] || '2025-05';

  if (!filePath) {
    console.log('Usage: pnpm compare-shows <file> [show1-pattern] [show2-pattern]');
    console.log('Example: pnpm compare-shows show.show.gz 2025-03 2025-05');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Find all show names
  const strings = scanForStrings(buffer, 4, 64);
  const showStrings = strings.filter(s =>
    s.value.toLowerCase().includes('hillsong') ||
    s.value.toLowerCase().includes('show') ||
    s.value.match(/\d{4}-\d{2}/)
  );

  console.log('=== Show names found ===');
  for (const s of showStrings.slice(0, 20)) {
    console.log(`  0x${s.offset.toString(16)}: "${s.value}"`);
  }
  console.log('');

  // Find the two shows we want to compare
  const show1 = strings.find(s => s.value.includes(show1Pattern));
  const show2 = strings.find(s => s.value.includes(show2Pattern));

  if (!show1 || !show2) {
    console.error(`Could not find shows matching "${show1Pattern}" and "${show2Pattern}"`);
    process.exit(1);
  }

  console.log(`Show 1: "${show1.value}" at 0x${show1.offset.toString(16)}`);
  console.log(`Show 2: "${show2.value}" at 0x${show2.offset.toString(16)}`);
  console.log('');

  // Look for show boundaries by finding record markers before/after names
  // The show data likely starts well before the name string

  // Strategy: Look for differences in a wide area around where shows would be
  // Since shows are stored as complete data blocks, find major structural differences

  // Let's scan the entire file for regions that differ
  console.log('=== Scanning for differences between potential show regions ===\n');

  // First, let's identify potential show boundaries by looking for "MA DATA" sub-sections
  // or other structural markers
  const showMarkers: number[] = [];

  // Look for potential section markers (often 0x00000000 padding followed by type markers)
  for (let i = 0; i < buffer.length - 8; i += 4) {
    // Look for potential show header patterns
    const v = buffer.readUInt32LE(i);

    // Common patterns that might indicate show boundaries
    if (v === 0x00010000 || v === 0x00020000 || v === 0x00030000) {
      const next = buffer.readUInt32LE(i + 4);
      if (next > 0x1000 && next < 0x100000) {
        // Possible section with length
        showMarkers.push(i);
      }
    }
  }

  console.log(`Found ${showMarkers.length} potential section markers`);
  for (const m of showMarkers.slice(0, 10)) {
    console.log(`  0x${m.toString(16)}`);
  }
  console.log('');

  // More direct approach: Find all fixture marker occurrences and map which show they belong to
  console.log('=== Mapping fixture markers to shows ===\n');

  const FIXTURE_MARKER = 0x3eb98358;
  const fixturesByShow: Map<string, number[]> = new Map();

  for (let i = 0; i < buffer.length - 32; i++) {
    if (buffer.readUInt32LE(i) === FIXTURE_MARKER) {
      // Find closest show name before this offset
      let closestShow = 'unknown';
      let closestDist = Infinity;

      for (const s of showStrings) {
        if (s.offset < i && i - s.offset < closestDist) {
          closestDist = i - s.offset;
          closestShow = s.value;
        }
      }

      if (!fixturesByShow.has(closestShow)) {
        fixturesByShow.set(closestShow, []);
      }
      fixturesByShow.get(closestShow)!.push(i);
    }
  }

  for (const [show, fixtures] of fixturesByShow) {
    if (fixtures.length > 5) {
      console.log(`${show}: ${fixtures.length} fixtures (0x${fixtures[0].toString(16)} - 0x${fixtures[fixtures.length-1].toString(16)})`);
    }
  }
  console.log('');

  // Now let's do a byte-by-byte comparison of regions around show1 and show2
  // We need to find their actual data boundaries first

  // Find the range for each show based on fixture markers
  const show1Fixtures = fixturesByShow.get(show1.value) || [];
  const show2Fixtures = fixturesByShow.get(show2.value) || [];

  if (show1Fixtures.length === 0 || show2Fixtures.length === 0) {
    console.log('Could not find fixtures for both shows');
    console.log(`Show1 fixtures: ${show1Fixtures.length}`);
    console.log(`Show2 fixtures: ${show2Fixtures.length}`);
  }

  // Different approach: Compare the binary data structure around the show names
  // The patch data should be near the fixtures but in a separate section

  console.log('=== Looking for DMX address patterns near shows ===\n');

  // For each show, look for universe/address patterns in a range before/after the fixtures
  for (const [showName, pattern] of [[show1.value, show1Pattern], [show2.value, show2Pattern]] as const) {
    const fixtures = fixturesByShow.get(showName) || [];
    if (fixtures.length === 0) continue;

    const minOffset = Math.min(...fixtures);
    const maxOffset = Math.max(...fixtures);

    console.log(`\n=== ${pattern}: fixtures at 0x${minOffset.toString(16)} - 0x${maxOffset.toString(16)} ===`);

    // Look in a range around the fixtures for DMX patterns
    // Search for universe byte (0, 1, 2) followed by sequential addresses
    const searchStart = Math.max(0, minOffset - 0x100000);
    const searchEnd = Math.min(buffer.length, maxOffset + 0x100000);

    // Look for address table patterns specific to this show's fixture count
    const fixtureCount = fixtures.length;
    console.log(`Looking for ${fixtureCount}-entry address tables...`);

    // Search for sequential 16-bit values that could be DMX addresses
    for (let recordSize = 2; recordSize <= 8; recordSize += 2) {
      const tables: number[] = [];

      for (let i = searchStart; i < searchEnd - recordSize * 20; i++) {
        let isSequential = true;
        const first = buffer.readUInt16LE(i);

        // Skip if first address isn't valid
        if (first < 1 || first > 10) continue;

        // Check for +1 or +3 sequence
        for (let j = 1; j < Math.min(20, fixtureCount); j++) {
          const addr = buffer.readUInt16LE(i + j * recordSize);
          // Check for +1 pattern
          if (addr !== first + j && addr !== first + j * 3) {
            isSequential = false;
            break;
          }
        }

        if (isSequential) {
          tables.push(i);
          if (tables.length >= 5) break;
        }
      }

      if (tables.length > 0) {
        console.log(`  Record size ${recordSize}: ${tables.length} potential tables`);
        for (const t of tables.slice(0, 2)) {
          console.log(`    0x${t.toString(16)}:`);
          dumpHex(buffer, t, 32);
        }
      }
    }
  }

  // Direct binary diff approach
  console.log('\n=== Direct binary comparison of show regions ===\n');

  // Estimate show boundaries based on fixture locations
  const allOffsets = [...fixturesByShow.entries()]
    .flatMap(([name, offsets]) => offsets.map(o => ({ name, offset: o })))
    .sort((a, b) => a.offset - b.offset);

  // Group consecutive fixtures that likely belong to the same show
  const showRanges: Array<{ name: string; start: number; end: number }> = [];
  let currentShow = '';
  let rangeStart = 0;
  let rangeEnd = 0;

  for (const entry of allOffsets) {
    if (entry.name !== currentShow || entry.offset - rangeEnd > 0x10000) {
      if (currentShow) {
        showRanges.push({ name: currentShow, start: rangeStart, end: rangeEnd });
      }
      currentShow = entry.name;
      rangeStart = entry.offset;
    }
    rangeEnd = entry.offset;
  }
  if (currentShow) {
    showRanges.push({ name: currentShow, start: rangeStart, end: rangeEnd });
  }

  console.log('Estimated show ranges:');
  for (const r of showRanges) {
    if (r.name.includes('hillsong')) {
      console.log(`  ${r.name}: 0x${r.start.toString(16)} - 0x${r.end.toString(16)} (${((r.end - r.start) / 1024).toFixed(1)} KB)`);
    }
  }

  // Find the ranges for our two target shows
  const range1 = showRanges.find(r => r.name.includes(show1Pattern));
  const range2 = showRanges.find(r => r.name.includes(show2Pattern));

  if (range1 && range2) {
    console.log(`\nComparing ${show1Pattern} and ${show2Pattern}...`);

    // These shows should have similar structure but different patch data
    // Find corresponding regions and compare them

    // Look for differences in areas that could contain DMX data
    // (areas with lots of small numbers 0-255 or 0-512)

    const range1Data = buffer.slice(range1.start, range1.end + 0x10000);
    const range2Data = buffer.slice(range2.start, range2.end + 0x10000);

    console.log(`Range 1 size: ${range1Data.length} bytes`);
    console.log(`Range 2 size: ${range2Data.length} bytes`);

    // Find blocks that differ
    const blockSize = 256;
    const diffs: Array<{ offset1: number; offset2: number }> = [];

    // Align by relative position in each range
    const len = Math.min(range1Data.length, range2Data.length);

    for (let i = 0; i < len; i += blockSize) {
      let differs = false;
      for (let j = 0; j < blockSize && i + j < len; j++) {
        if (range1Data[i + j] !== range2Data[i + j]) {
          differs = true;
          break;
        }
      }
      if (differs) {
        diffs.push({
          offset1: range1.start + i,
          offset2: range2.start + i
        });
      }
    }

    console.log(`\nFound ${diffs.length} differing blocks (${blockSize}-byte blocks)`);

    // Show first few diffs
    for (const d of diffs.slice(0, 10)) {
      console.log(`\nDiff at relative offset 0x${(d.offset1 - range1.start).toString(16)}:`);
      console.log('Show 1:');
      dumpHex(buffer, d.offset1, 48);
      console.log('Show 2:');
      dumpHex(buffer, d.offset2, 48);
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
