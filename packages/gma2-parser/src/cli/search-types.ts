#!/usr/bin/env node
/**
 * Search for fixture type names in GMA2 show files
 */
import { loadShowFile } from '../binary/decompressor.js';
import { scanForStrings } from '../binary/record-parser.js';

async function main() {
  const filePath = process.argv[2];
  const pattern = process.argv[3]?.toLowerCase();

  if (!filePath) {
    console.log('Usage: pnpm search-types <show.show.gz> [pattern]');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  const strings = scanForStrings(buffer, 4, 128);

  // Known fixture manufacturer/model keywords
  const keywords = [
    'robe', 'robin', 'pointe', 'ledwash', 'ledbeam',
    'martin', 'mac', 'viper',
    'clay paky', 'sharpy', 'mythos',
    'chauvet', 'rogue',
    'elation', 'rush',
    'glp', 'impression',
    'generic', 'dimmer', 'par',
    'profile', 'wash', 'beam', 'spot',
    'moving', 'mover'
  ];

  const fixtureTypes = strings.filter(s => {
    const lower = s.value.toLowerCase();
    if (pattern) {
      return lower.includes(pattern);
    }
    return keywords.some(kw => lower.includes(kw));
  });

  // Dedupe by value
  const seen = new Set<string>();
  const unique = fixtureTypes.filter(s => {
    if (seen.has(s.value)) return false;
    seen.add(s.value);
    return true;
  });

  console.log(`Found ${unique.length} fixture type references:\n`);

  // Group by approximate offset range
  const showArea = unique.filter(s => s.offset < 0x500000);
  const libraryArea = unique.filter(s => s.offset >= 0x500000);

  if (showArea.length > 0) {
    console.log('=== Show Data Area (< 0x500000) ===');
    for (const s of showArea.slice(0, 50)) {
      console.log(`0x${s.offset.toString(16).padStart(8, '0')}: "${s.value}"`);
    }
    console.log('');
  }

  if (libraryArea.length > 0) {
    console.log('=== Library Area (>= 0x500000) ===');
    for (const s of libraryArea.slice(0, 100)) {
      console.log(`0x${s.offset.toString(16).padStart(8, '0')}: "${s.value}"`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
