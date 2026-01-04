#!/usr/bin/env node
/**
 * Analyze the promising patch regions found at 0x26c1 and 0x2776
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm analyze-patch-region <file>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Region 1: 0x26c1 area
  console.log('=== Region around 0x26c1 (wider context) ===\n');
  dumpHex(buffer, 0x2600, 0x300);

  // Region 2: 0x2776 area
  console.log('\n=== Region around 0x2776 ===\n');
  dumpHex(buffer, 0x2700, 0x200);

  // The interesting pattern at 0x27d0 shows:
  // 45 00 00 00 01 00 00 00 (E, 1)
  // 56 00 00 00 02 00 00 00 (V, 2)
  // etc.
  // This could be fixture ID mapping

  console.log('\n=== Analyzing 8-byte records at 0x27d0 ===\n');
  const tableStart = 0x27d0;
  const recordSize = 8;

  for (let i = 0; i < 20; i++) {
    const offset = tableStart + i * recordSize;
    const byte1 = buffer.readUInt32LE(offset);
    const byte2 = buffer.readUInt32LE(offset + 4);
    const char = byte1 < 128 ? String.fromCharCode(byte1) : '?';
    console.log(`Record ${i}: value1=0x${byte1.toString(16)} (${byte1}, '${char}'), value2=${byte2}`);
  }

  // Now let's look for where actual DMX addresses might be stored
  // The pattern shows fixture IDs (0x45=69, 0x56=86, etc.) with sequential indices
  // The actual DMX patch is probably elsewhere

  console.log('\n=== Looking for DMX address tables by searching for value patterns ===\n');

  // Search for sequences where we have lots of small values (1-512)
  // that increment by 1 or 3

  const candidates: Array<{ offset: number; pattern: string; values: number[] }> = [];

  for (let i = 0; i < buffer.length - 400; i += 4) {
    // Read 100 consecutive 32-bit values
    const values: number[] = [];
    for (let j = 0; j < 100; j++) {
      if (i + j * 4 < buffer.length - 4) {
        values.push(buffer.readUInt32LE(i + j * 4));
      }
    }

    // Check for +1 pattern (channels 1, 2, 3, 4...)
    if (values.length >= 100) {
      let is1Ch = true;
      for (let j = 0; j < 100; j++) {
        if (values[j] !== j + 1) {
          is1Ch = false;
          break;
        }
      }

      if (is1Ch) {
        candidates.push({ offset: i, pattern: '1-ch', values: values.slice(0, 10) });
      }
    }

    // Check for +3 pattern (channels 1, 4, 7, 10...)
    if (values.length >= 100) {
      let is3Ch = true;
      for (let j = 0; j < 100; j++) {
        if (values[j] !== j * 3 + 1) {
          is3Ch = false;
          break;
        }
      }

      if (is3Ch) {
        candidates.push({ offset: i, pattern: '3-ch', values: values.slice(0, 10) });
      }
    }
  }

  console.log(`Found ${candidates.length} potential 100-entry address tables`);
  for (const c of candidates) {
    console.log(`\n0x${c.offset.toString(16)}: ${c.pattern} pattern`);
    console.log(`First 10 values: [${c.values.join(', ')}]`);
    dumpHex(buffer, c.offset, 64);
  }

  // Also try 16-bit values
  console.log('\n\n=== Trying 16-bit address tables ===\n');

  for (let i = 0; i < buffer.length - 200; i += 2) {
    const values: number[] = [];
    for (let j = 0; j < 100; j++) {
      if (i + j * 2 < buffer.length - 2) {
        values.push(buffer.readUInt16LE(i + j * 2));
      }
    }

    // Check for +1 pattern
    if (values.length >= 100) {
      let is1Ch = true;
      for (let j = 0; j < 100; j++) {
        if (values[j] !== j + 1) {
          is1Ch = false;
          break;
        }
      }

      if (is1Ch) {
        console.log(`\n16-bit 1-ch pattern at 0x${i.toString(16)}:`);
        console.log(`First 10 values: [${values.slice(0, 10).join(', ')}]`);
        dumpHex(buffer, i, 64);
      }
    }

    // Check for +3 pattern
    if (values.length >= 100) {
      let is3Ch = true;
      for (let j = 0; j < 100; j++) {
        if (values[j] !== j * 3 + 1) {
          is3Ch = false;
          break;
        }
      }

      if (is3Ch) {
        console.log(`\n16-bit 3-ch pattern at 0x${i.toString(16)}:`);
        console.log(`First 10 values: [${values.slice(0, 10).join(', ')}]`);
        dumpHex(buffer, i, 64);
      }
    }
  }

  // Also search for universe markers combined with address tables
  console.log('\n\n=== Looking for (universe, address) pairs ===\n');

  // Try 4-byte records: [universe (8-bit), padding (8-bit), address (16-bit)]
  for (let i = 0; i < buffer.length - 400; i++) {
    let valid = true;
    const entries: Array<{ u: number; a: number }> = [];

    for (let j = 0; j < 100 && valid; j++) {
      const offset = i + j * 4;
      if (offset + 4 > buffer.length) {
        valid = false;
        break;
      }

      const u = buffer[offset];
      const pad = buffer[offset + 1];
      const a = buffer.readUInt16LE(offset + 2);

      // Universe should be 0-3, address should be sequential
      if (u > 3 || (pad !== 0 && u !== 0)) {
        valid = false;
        break;
      }

      const expectedAddr1Ch = j + 1;
      const expectedAddr3Ch = j * 3 + 1;

      if (a !== expectedAddr1Ch && a !== expectedAddr3Ch) {
        valid = false;
        break;
      }

      entries.push({ u, a });
    }

    if (valid && entries.length >= 50) {
      console.log(`\n(u8 universe, u8 pad, u16 addr) at 0x${i.toString(16)}:`);
      console.log(`First 10: ${entries.slice(0, 10).map(e => `U${e.u}:${e.a}`).join(', ')}`);
      dumpHex(buffer, i, 64);
    }
  }

  // Look for the fixture-to-DMX mapping in a different format
  // Perhaps: [fixture_id (32-bit), universe (8-bit), address (16-bit), channels (8-bit)]
  console.log('\n\n=== Looking for fixture-DMX mapping records ===\n');

  // We know fixture IDs go up to around 100+
  // Search for records that contain fixture IDs paired with small universe/address values

  // Simpler: look for runs of records where one field increments
  for (let recordSize = 6; recordSize <= 16; recordSize += 2) {
    for (let addrOffset = 0; addrOffset < recordSize - 1; addrOffset++) {
      let foundTable = false;

      for (let i = 0; i < buffer.length - recordSize * 50 && !foundTable; i++) {
        let valid = true;
        const addrs: number[] = [];

        for (let j = 0; j < 50; j++) {
          const addr = buffer.readUInt16LE(i + j * recordSize + addrOffset);
          const expected1Ch = j + 1;
          const expected3Ch = j * 3 + 1;

          if (addr !== expected1Ch && addr !== expected3Ch && addr !== j) {
            valid = false;
            break;
          }
          addrs.push(addr);
        }

        if (valid && addrs.length >= 50) {
          console.log(`\nRecord size ${recordSize}, addr at offset ${addrOffset}: found at 0x${i.toString(16)}`);
          console.log(`First 10 addrs: [${addrs.slice(0, 10).join(', ')}]`);
          dumpHex(buffer, i, recordSize * 5);
          foundTable = true;
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
