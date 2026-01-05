#!/usr/bin/env node
/**
 * Find patch table in GMA2 show files
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';

// Known fixture offsets
const FIXTURE_OFFSETS = [
  0x00027215, // Moving 1
  0x0002c0ba, // Moving 2
  0x00030f4d, // Moving 3
  0x00035de0, // Moving 4
  0x0001cbce, // Blinder
  0x0003f224, // Strobe
];

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm find-patch <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Analyze each fixture record in detail
  console.log('=== Detailed Fixture Analysis ===\n');

  for (const offset of FIXTURE_OFFSETS) {
    const reader = new BinaryReader(buffer, offset);
    const name = reader.readNullTerminatedString(64);
    console.log(`${name} @ 0x${offset.toString(16)}`);

    // Read bytes after name
    const nameLen = name.length + 1; // +1 for null
    reader.seek(offset + nameLen);

    console.log('  Post-name bytes (raw):');
    for (let i = 0; i < 8; i++) {
      const pos = offset + nameLen + i * 4;
      const val = buffer.readUInt32LE(pos);
      const bytes = buffer.subarray(pos, pos + 4);
      const hexBytes = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`    +${(i*4).toString().padStart(2)}: ${hexBytes}  (u32: ${val.toString().padStart(10)}, 0x${val.toString(16).padStart(8, '0')})`);
    }

    // Read header bytes
    console.log('  Header bytes:');
    for (let i = 0; i < 8; i++) {
      const pos = offset - 48 + i * 4;
      const val = buffer.readUInt32LE(pos);
      const bytes = buffer.subarray(pos, pos + 4);
      const hexBytes = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      const relOffset = (i * 4 - 48);
      console.log(`    ${relOffset.toString().padStart(3)}: ${hexBytes}  (u32: ${val.toString().padStart(10)}, 0x${val.toString(16).padStart(8, '0')})`);
    }
    console.log('');
  }

  // Look for patterns where bytes match expected DMX structure
  console.log('=== Looking for Patch Table ===\n');

  // Pattern: Small fixture ID (1-100) followed by universe (0-15) and address (1-512)
  // Try different field sizes
  const patterns: Array<{name: string; size: number}> = [
    { name: '4+2+2 (ID32, Univ16, Addr16)', size: 8 },
    { name: '2+1+2 (ID16, Univ8, Addr16)', size: 5 },
    { name: '4+4+4 (ID32, Univ32, Addr32)', size: 12 },
  ];

  for (const pattern of patterns) {
    console.log(`Trying pattern: ${pattern.name}`);
    let found = 0;

    for (let i = 0; i < buffer.length - pattern.size * 4; i++) {
      let matches = 0;

      for (let j = 0; j < 4; j++) {
        const base = i + j * pattern.size;

        if (pattern.size === 8) {
          const id = buffer.readUInt32LE(base);
          const univ = buffer.readUInt16LE(base + 4);
          const addr = buffer.readUInt16LE(base + 6);

          // Check for sequential IDs starting from 1
          if (id === j + 1 && univ <= 15 && addr >= 1 && addr <= 512) {
            matches++;
          }
        } else if (pattern.size === 5) {
          const id = buffer.readUInt16LE(base);
          const univ = buffer.readUInt8(base + 2);
          const addr = buffer.readUInt16LE(base + 3);

          if (id === j + 1 && univ <= 15 && addr >= 1 && addr <= 512) {
            matches++;
          }
        } else if (pattern.size === 12) {
          const id = buffer.readUInt32LE(base);
          const univ = buffer.readUInt32LE(base + 4);
          const addr = buffer.readUInt32LE(base + 8);

          if (id === j + 1 && univ <= 15 && addr >= 1 && addr <= 512) {
            matches++;
          }
        }
      }

      if (matches >= 3) {
        console.log(`  Potential match at 0x${i.toString(16)}:`);
        for (let j = 0; j < 4; j++) {
          const base = i + j * pattern.size;
          if (pattern.size === 8) {
            const id = buffer.readUInt32LE(base);
            const univ = buffer.readUInt16LE(base + 4);
            const addr = buffer.readUInt16LE(base + 6);
            console.log(`    ID ${id}: Univ ${univ}, Addr ${addr}`);
          } else if (pattern.size === 5) {
            const id = buffer.readUInt16LE(base);
            const univ = buffer.readUInt8(base + 2);
            const addr = buffer.readUInt16LE(base + 3);
            console.log(`    ID ${id}: Univ ${univ}, Addr ${addr}`);
          } else if (pattern.size === 12) {
            const id = buffer.readUInt32LE(base);
            const univ = buffer.readUInt32LE(base + 4);
            const addr = buffer.readUInt32LE(base + 8);
            console.log(`    ID ${id}: Univ ${univ}, Addr ${addr}`);
          }
        }
        found++;
        if (found >= 3) break;
      }
    }

    if (found === 0) {
      console.log('  No matches found');
    }
    console.log('');
  }

  // Alternative: Search for references TO the fixture offsets
  console.log('=== Searching for References to Fixture Offsets ===\n');

  for (const offset of FIXTURE_OFFSETS) {
    const offBytes = Buffer.alloc(4);
    offBytes.writeUInt32LE(offset);

    let found = 0;
    for (let i = 0; i < buffer.length - 4; i++) {
      if (buffer.readUInt32LE(i) === offset) {
        console.log(`Reference to 0x${offset.toString(16)} found at 0x${i.toString(16)}`);
        found++;
        if (found >= 5) break;
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
