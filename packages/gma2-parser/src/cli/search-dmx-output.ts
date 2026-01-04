#!/usr/bin/env node
/**
 * Search for DMX output configuration
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';
import { scanForStrings } from '../binary/record-parser.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-output <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  const strings = scanForStrings(buffer, 3, 64);

  // Search for output/layer related strings
  const outputStrings = strings.filter(s => {
    const lower = s.value.toLowerCase();
    return lower.includes('layer') ||
           lower.includes('output') ||
           lower.includes('port') ||
           lower.includes('artnet') ||
           lower.includes('sacn') ||
           lower.includes('executor') ||
           lower.includes('fader');
  });

  const seen = new Set<string>();
  console.log('Output/Layer related strings:');

  for (const s of outputStrings) {
    if (seen.has(s.value)) continue;
    if (s.value.length > 30) continue;
    seen.add(s.value);
    console.log(`  0x${s.offset.toString(16).padStart(8, '0')}: "${s.value}"`);
  }
  console.log('');

  // Look at the Port strings area (these might be DMX outputs)
  const portStrings = strings.filter(s => s.value.match(/^Port \d+$/));
  if (portStrings.length > 0) {
    console.log('\nPort strings found - analyzing first few:');
    for (const p of portStrings.slice(0, 5)) {
      console.log(`\n=== ${p.value} at 0x${p.offset.toString(16)} ===`);
      dumpContext(buffer, p.offset, 32, 64);
    }
  }

  // Search for fixture-to-address mappings
  // Look for patterns with small numbers (fixture indices) followed by DMX-range values
  console.log('\n\nSearching for fixture ID to address patterns...');

  // The fixture indices we found: 6, 10, 12, 14, 16, 20
  // Search for any of these followed by universe (0-15) and address (1-512)
  const fixtureIndices = [6, 10, 12, 14, 16, 20];

  for (let i = 0; i < buffer.length - 12; i++) {
    const id = buffer.readUInt16LE(i);

    // Check if this matches a known fixture index
    if (!fixtureIndices.includes(id)) continue;

    // Look for following values that could be universe and address
    const v1 = buffer.readUInt16LE(i + 2);
    const v2 = buffer.readUInt16LE(i + 4);
    const v3 = buffer.readUInt16LE(i + 6);

    // Universe should be 0-15, address should be 1-512
    if ((v1 <= 15 && v2 >= 1 && v2 <= 512) ||
        (v2 <= 15 && v3 >= 1 && v3 <= 512)) {
      console.log(`  Potential at 0x${i.toString(16)}: ID=${id}, next values: ${v1}, ${v2}, ${v3}`);

      // Check context
      if (buffer.length > i + 20) {
        const nextId = buffer.readUInt16LE(i + 8);
        if (fixtureIndices.includes(nextId)) {
          console.log(`    Next ID: ${nextId} - LOOKS LIKE A TABLE!`);
          // Dump more context
          dumpHex(buffer, i, 48);
        }
      }
    }
  }
}

function dumpContext(buffer: Buffer, offset: number, before: number, after: number) {
  const start = Math.max(0, offset - before);
  const end = Math.min(buffer.length, offset + after);

  for (let i = start; i < end; i += 16) {
    const relOffset = i - offset;
    const hex: string[] = [];
    const ascii: string[] = [];

    for (let j = 0; j < 16 && i + j < end; j++) {
      const b = buffer[i + j];
      hex.push(b.toString(16).padStart(2, '0'));
      ascii.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
    }

    const relStr = relOffset >= 0 ? `+${relOffset}` : `${relOffset}`;
    console.log(`  ${relStr.padStart(4)}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
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

    console.log(`      0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
