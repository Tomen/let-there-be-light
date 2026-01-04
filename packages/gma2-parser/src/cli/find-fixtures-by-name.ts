#!/usr/bin/env node
/**
 * Find fixtures by searching for known fixture name patterns
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm find-fixtures-by-name <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Search for common fixture name patterns
  const patterns = [
    'Dimmer', 'dimmer',
    'Par', 'par',
    'Moving', 'moving',
    'Wash', 'wash',
    'Spot', 'spot',
    'LED', 'led',
    'Front', 'Back', 'Side',
    'Stage', 'stage',
  ];

  const foundFixtures: Array<{ name: string; offset: number }> = [];

  for (const pattern of patterns) {
    const patternBytes = Buffer.from(pattern);

    for (let i = 0; i < buffer.length - pattern.length; i++) {
      if (buffer.slice(i, i + pattern.length).equals(patternBytes)) {
        // Check if this looks like a fixture name (followed by space/null or number)
        const nextChar = buffer[i + pattern.length];
        const prevChar = i > 0 ? buffer[i - 1] : 0;

        // Should start at word boundary
        if (prevChar !== 0 && prevChar !== 32) continue;

        // Extract full name
        let name = pattern;
        for (let j = pattern.length; j < 64; j++) {
          const c = buffer[i + j];
          if (c === 0) break;
          if (c >= 32 && c < 127) {
            name += String.fromCharCode(c);
          } else {
            break;
          }
        }

        if (name.length >= 4 && name.length < 40) {
          // Check if name ends with a number (common for fixtures)
          if (/\d$/.test(name) || /\d\s*$/.test(name)) {
            foundFixtures.push({ name: name.trim(), offset: i });
          }
        }
      }
    }
  }

  // Deduplicate by name
  const uniqueByName = new Map<string, number>();
  for (const f of foundFixtures) {
    if (!uniqueByName.has(f.name)) {
      uniqueByName.set(f.name, f.offset);
    }
  }

  console.log(`Found ${uniqueByName.size} unique fixture-like strings:\n`);

  // Sort by offset
  const sorted = [...uniqueByName.entries()].sort((a, b) => a[1] - b[1]);

  // Show first 30
  for (const [name, offset] of sorted.slice(0, 30)) {
    console.log(`0x${offset.toString(16).padStart(8, '0')}: "${name}"`);
  }

  // Now dump context around the first few to find the record structure
  console.log('\n\n=== Context around first 5 fixtures ===\n');

  for (const [name, offset] of sorted.slice(0, 5)) {
    console.log(`\n--- "${name}" at 0x${offset.toString(16)} ---`);
    console.log('\nBefore name (-96 bytes):');
    dumpHex(buffer, Math.max(0, offset - 96), 96);
    console.log('\nName and after:');
    dumpHex(buffer, offset, 64);

    // Look for potential marker patterns before the name
    console.log('\n32-bit values before name:');
    for (let i = offset - 64; i < offset; i += 4) {
      if (i >= 0) {
        const val = buffer.readUInt32LE(i);
        console.log(`  ${i - offset}: 0x${val.toString(16).padStart(8, '0')}`);
      }
    }
  }

  // Look for repeated marker patterns
  console.log('\n\n=== Looking for common patterns before fixture names ===\n');

  const patterns32: Map<number, number> = new Map();
  const offsetsWithPatterns: Map<number, number[]> = new Map();

  for (const [, offset] of sorted.slice(0, 50)) {
    for (let relOffset = -64; relOffset < 0; relOffset += 4) {
      const absOffset = offset + relOffset;
      if (absOffset >= 0 && absOffset + 4 <= buffer.length) {
        const val = buffer.readUInt32LE(absOffset);
        patterns32.set(val, (patterns32.get(val) || 0) + 1);

        if (!offsetsWithPatterns.has(relOffset)) {
          offsetsWithPatterns.set(relOffset, []);
        }
        offsetsWithPatterns.get(relOffset)!.push(val);
      }
    }
  }

  // Find the most common patterns
  const sortedPatterns = [...patterns32.entries()].sort((a, b) => b[1] - a[1]);
  console.log('Most common 32-bit values before fixture names:');
  for (const [val, count] of sortedPatterns.slice(0, 10)) {
    console.log(`  0x${val.toString(16).padStart(8, '0')}: appears ${count} times`);
  }

  // Check which relative offset has the marker
  console.log('\n\nValues at each relative offset:');
  for (const [relOffset, values] of offsetsWithPatterns) {
    const unique = new Set(values);
    const mostCommon = [...unique]
      .map(v => ({ v, count: values.filter(x => x === v).length }))
      .sort((a, b) => b.count - a.count)[0];

    if (mostCommon && mostCommon.count > 20) {
      console.log(`  ${relOffset}: most common = 0x${mostCommon.v.toString(16)} (${mostCommon.count}/${values.length} times)`);
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
