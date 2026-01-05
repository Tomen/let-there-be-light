#!/usr/bin/env node
/**
 * Extract the full patch table from the GrandMA2 show file
 *
 * Record format (28 bytes):
 * - u16 constant (100 = 0x64)
 * - u16 constant (24 = 0x18)
 * - 6 bytes padding (zeros)
 * - u32 universe (0 = U1, 1 = U2, 2 = U3)
 * - u32 fixture index (1-based)
 * - 10 bytes padding (zeros)
 */
import { loadShowFile } from '../binary/decompressor.js';

interface PatchRecord {
  offset: number;
  universe: number;  // 0-based (0=U1, 1=U2, 2=U3)
  fixtureIndex: number;
  dmxAddress?: number;  // Calculated
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm extract-full-patch <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  const HEADER = Buffer.from([0x64, 0x00, 0x18, 0x00]);
  const RECORD_SIZE = 28;

  const records: PatchRecord[] = [];

  // Scan the entire file for patch records
  for (let i = 0; i < buffer.length - RECORD_SIZE; i++) {
    if (buffer[i] === 0x64 && buffer[i+1] === 0x00 &&
        buffer[i+2] === 0x18 && buffer[i+3] === 0x00) {

      // Verify padding is zeros
      let validPadding = true;
      for (let j = 4; j < 10; j++) {
        if (buffer[i + j] !== 0) {
          validPadding = false;
          break;
        }
      }

      if (validPadding) {
        const universe = buffer.readUInt32LE(i + 10);
        const fixtureIndex = buffer.readUInt32LE(i + 14);

        // Filter valid values
        if (universe <= 4 && fixtureIndex > 0 && fixtureIndex <= 200) {
          records.push({
            offset: i,
            universe,
            fixtureIndex,
          });
        }
      }
    }
  }

  console.log(`Found ${records.length} patch records\n`);

  // Group by universe
  const byUniverse = new Map<number, PatchRecord[]>();
  for (const r of records) {
    if (!byUniverse.has(r.universe)) {
      byUniverse.set(r.universe, []);
    }
    byUniverse.get(r.universe)!.push(r);
  }

  // Calculate DMX addresses based on user intel:
  // - U1 (universe 0): 1 channel per fixture
  // - U3 (universe 2): 3 channels per fixture
  const channelsPerUniverse: Record<number, number> = {
    0: 1,  // Universe 1
    1: 1,  // Universe 2 (unknown, assume 1)
    2: 3,  // Universe 3
  };

  console.log('=== Summary by Universe ===\n');

  for (const [universe, recs] of [...byUniverse.entries()].sort((a, b) => a[0] - b[0])) {
    const sortedRecs = recs.sort((a, b) => a.fixtureIndex - b.fixtureIndex);
    const indices = sortedRecs.map(r => r.fixtureIndex);
    const uniqueIndices = [...new Set(indices)];
    const channels = channelsPerUniverse[universe] || 1;

    console.log(`Universe ${universe} (U${universe + 1}): ${sortedRecs.length} records`);
    console.log(`  Fixture indices: ${uniqueIndices.slice(0, 15).join(', ')}${uniqueIndices.length > 15 ? '...' : ''}`);
    console.log(`  Range: ${Math.min(...uniqueIndices)} to ${Math.max(...uniqueIndices)}`);
    console.log(`  Channels per fixture: ${channels}`);

    // Calculate DMX addresses
    const addresses = uniqueIndices.map(idx => (idx - 1) * channels + 1);
    console.log(`  DMX addresses: ${addresses.slice(0, 15).join(', ')}${addresses.length > 15 ? '...' : ''}`);
    console.log('');
  }

  // Show detailed records for Universe 3 (the 3-channel fixtures)
  console.log('\n=== Universe 2 (U3) - 3-channel fixtures ===\n');

  const u3Records = byUniverse.get(2) || [];
  const sortedU3 = u3Records.sort((a, b) => a.fixtureIndex - b.fixtureIndex);

  console.log('Index | DMX Addr | Offset');
  console.log('------|----------|--------');

  for (const r of sortedU3.slice(0, 30)) {
    const dmxAddr = (r.fixtureIndex - 1) * 3 + 1;
    console.log(`${r.fixtureIndex.toString().padStart(5)} | ${dmxAddr.toString().padStart(8)} | 0x${r.offset.toString(16)}`);
  }

  // Show detailed records for Universe 1 (the 1-channel fixtures)
  console.log('\n\n=== Universe 0 (U1) - 1-channel fixtures ===\n');

  const u1Records = byUniverse.get(0) || [];
  const sortedU1 = u1Records.sort((a, b) => a.fixtureIndex - b.fixtureIndex);

  console.log('Index | DMX Addr | Offset');
  console.log('------|----------|--------');

  for (const r of sortedU1.slice(0, 30)) {
    const dmxAddr = r.fixtureIndex;  // 1-channel, so index = address
    console.log(`${r.fixtureIndex.toString().padStart(5)} | ${dmxAddr.toString().padStart(8)} | 0x${r.offset.toString(16)}`);
  }

  // Look for contiguous blocks
  console.log('\n\n=== Contiguous patch blocks ===\n');

  const allRecords = [...records].sort((a, b) => a.offset - b.offset);
  let blockStart = allRecords[0]?.offset;
  let blockCount = 1;
  let currentUniverse = allRecords[0]?.universe;

  const blocks: Array<{start: number; count: number; universe: number}> = [];

  for (let i = 1; i < allRecords.length; i++) {
    const prev = allRecords[i - 1];
    const curr = allRecords[i];

    if (curr.offset === prev.offset + RECORD_SIZE && curr.universe === prev.universe) {
      blockCount++;
    } else {
      blocks.push({ start: blockStart, count: blockCount, universe: currentUniverse });
      blockStart = curr.offset;
      blockCount = 1;
      currentUniverse = curr.universe;
    }
  }
  blocks.push({ start: blockStart, count: blockCount, universe: currentUniverse });

  // Show blocks with more than 5 records
  for (const b of blocks.filter(x => x.count >= 5)) {
    console.log(`Block at 0x${b.start.toString(16)}: ${b.count} records, Universe ${b.universe} (U${b.universe + 1})`);
  }

  // Dump hex around largest block
  console.log('\n\n=== Hex dump of first large block ===\n');

  const largestBlock = blocks.reduce((a, b) => a.count > b.count ? a : b);
  if (largestBlock) {
    console.log(`Largest block: ${largestBlock.count} records at 0x${largestBlock.start.toString(16)}`);
    dumpHex(buffer, largestBlock.start - 32, 256);
  }
}

function dumpHex(buffer: Buffer, offset: number, length: number) {
  const start = Math.max(0, offset);
  const end = Math.min(buffer.length, offset + length);

  for (let i = start; i < end; i += 16) {
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
