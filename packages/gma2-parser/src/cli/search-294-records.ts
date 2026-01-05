#!/usr/bin/env node
/**
 * Search for 0x126 (294) records which appear in the 2025 show region
 * Format seems to be: 26 01 00 00 [ptr] 00 00 00 00 02 00 00 [index]
 */
import { loadShowFile } from '../binary/decompressor.js';

interface Record294 {
  offset: number;
  nextPtr: number;
  universe: number;
  value1: number;
  value2: number;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-294 <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  const records: Record294[] = [];

  // Search for 26 01 00 00 pattern
  for (let i = 0; i < buffer.length - 20; i++) {
    if (buffer[i] === 0x26 && buffer[i+1] === 0x01 &&
        buffer[i+2] === 0x00 && buffer[i+3] === 0x00) {

      const nextPtr = buffer.readUInt32LE(i + 4);
      const zeros = buffer.readUInt32LE(i + 8);

      // Check for zeros at offset +8
      if (zeros === 0) {
        const universe = buffer[i + 12];
        const value1 = buffer[i + 15];  // Byte after universe bytes
        const value2 = buffer.readUInt32LE(i + 16);

        // Filter for universe 0-3
        if (universe <= 3) {
          records.push({
            offset: i,
            nextPtr,
            universe,
            value1,
            value2,
          });
        }
      }
    }
  }

  console.log(`Found ${records.length} records with 0x126 (294) marker\n`);

  // Group by universe
  const byUniverse = new Map<number, Record294[]>();
  for (const r of records) {
    if (!byUniverse.has(r.universe)) {
      byUniverse.set(r.universe, []);
    }
    byUniverse.get(r.universe)!.push(r);
  }

  console.log('=== Summary by Universe ===\n');
  for (const [u, recs] of [...byUniverse.entries()].sort((a, b) => a[0] - b[0])) {
    const values = recs.map(r => r.value1).sort((a, b) => a - b);
    const unique = [...new Set(values)];
    console.log(`Universe ${u} (U${u + 1}): ${recs.length} records`);
    console.log(`  Value1 range: ${Math.min(...values)} to ${Math.max(...values)}`);
    console.log(`  First 20 values: [${unique.slice(0, 20).join(', ')}]`);
    console.log('');
  }

  // Show sample records
  console.log('\n=== Sample records ===\n');
  for (const r of records.slice(0, 20)) {
    console.log(`0x${r.offset.toString(16)}: U${r.universe + 1} val1=${r.value1} val2=0x${r.value2.toString(16)}`);
  }

  // Check for contiguous blocks
  console.log('\n\n=== Contiguous blocks ===\n');

  const sorted = [...records].sort((a, b) => a.offset - b.offset);
  let blockStart = sorted[0]?.offset;
  let blockCount = 1;
  let blockUniverse = sorted[0]?.universe;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const expectedGap = 88;  // Typical record spacing

    if (curr.offset - prev.offset <= expectedGap * 2 && curr.universe === prev.universe) {
      blockCount++;
    } else {
      if (blockCount >= 10) {
        console.log(`Block at 0x${blockStart.toString(16)}: ${blockCount} records, Universe ${blockUniverse} (U${blockUniverse + 1})`);
      }
      blockStart = curr.offset;
      blockCount = 1;
      blockUniverse = curr.universe;
    }
  }
  if (blockCount >= 10) {
    console.log(`Block at 0x${blockStart.toString(16)}: ${blockCount} records, Universe ${blockUniverse} (U${blockUniverse + 1})`);
  }

  // Analyze value1 patterns
  console.log('\n\n=== Value1 pattern analysis ===\n');

  const u2Records = byUniverse.get(2) || [];
  const u2Sorted = u2Records.sort((a, b) => a.value1 - b.value1);

  console.log('Universe 2 (U3) value1 distribution:');
  const valueCounts = new Map<number, number>();
  for (const r of u2Sorted) {
    valueCounts.set(r.value1, (valueCounts.get(r.value1) || 0) + 1);
  }

  for (const [v, c] of [...valueCounts.entries()].sort((a, b) => a[0] - b[0]).slice(0, 30)) {
    console.log(`  ${v}: ${c} occurrences`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
