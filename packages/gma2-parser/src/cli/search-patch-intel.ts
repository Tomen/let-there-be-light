#!/usr/bin/env node
/**
 * Search for DMX patch data based on known configuration:
 * - Universe 1: ~100 fixtures, 1 channel each, addresses 1, 2, 3, 4...
 * - Universe 3: ~100 fixtures, 3 channels each, addresses 1, 4, 7, 10...
 */
import { loadShowFile } from '../binary/decompressor.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: pnpm search-patch-intel <show.show.gz>');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Search strategies based on intel

  // Strategy 1: Look for sequential addresses 1,2,3,4,5... as 16-bit values
  console.log('=== Strategy 1: Sequential 16-bit addresses (1,2,3,4,5...) ===\n');
  findSequential16(buffer, 1, 2, 3, 4, 5, 6, 7, 8);

  // Strategy 2: Look for 3-channel spacing (1,4,7,10...) as 16-bit values
  console.log('\n=== Strategy 2: 3-channel spacing (1,4,7,10...) ===\n');
  findSequential16(buffer, 1, 4, 7, 10, 13, 16);

  // Strategy 3: Look for universe identifiers (0,1,2,3) followed by address
  console.log('\n=== Strategy 3: Universe + Address patterns ===\n');
  searchUniverseAddressPatterns(buffer);

  // Strategy 4: Look for address + channel count patterns
  console.log('\n=== Strategy 4: Address + Channel Count patterns ===\n');
  searchAddressChannelPatterns(buffer);

  // Strategy 5: Search for 32-bit values that could be (universe << 16 | address)
  console.log('\n=== Strategy 5: Combined universe|address patterns ===\n');
  searchCombinedPatterns(buffer);
}

function findSequential16(buffer: Buffer, ...sequence: number[]) {
  const matches: number[] = [];

  for (let i = 0; i < buffer.length - sequence.length * 2; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      const val = buffer.readUInt16LE(i + j * 2);
      if (val !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  console.log(`Found ${matches.length} matches for sequence [${sequence.join(', ')}]`);
  for (const offset of matches.slice(0, 10)) {
    console.log(`  0x${offset.toString(16).padStart(8, '0')}`);
    dumpHex(buffer, offset, 32);
  }
  if (matches.length > 10) {
    console.log(`  ... and ${matches.length - 10} more`);
  }
}

function searchUniverseAddressPatterns(buffer: Buffer) {
  // Look for patterns like: universe (0-3), padding, address (1-512)
  const matches: Array<{offset: number; universe: number; address: number; format: string}> = [];

  for (let i = 0; i < buffer.length - 8; i++) {
    // Pattern A: u8 universe, u8 zero, u16 address
    const univA = buffer[i];
    const padA = buffer[i + 1];
    const addrA = buffer.readUInt16LE(i + 2);
    if (univA <= 3 && padA === 0 && addrA >= 1 && addrA <= 512) {
      // Check if next entry also matches
      const univA2 = buffer[i + 4];
      const padA2 = buffer[i + 5];
      const addrA2 = buffer.readUInt16LE(i + 6);
      if (univA2 <= 3 && padA2 === 0 && addrA2 >= 1 && addrA2 <= 512) {
        // Both match - likely a table
        matches.push({ offset: i, universe: univA, address: addrA, format: 'A' });
      }
    }

    // Pattern B: u16 universe, u16 address
    const univB = buffer.readUInt16LE(i);
    const addrB = buffer.readUInt16LE(i + 2);
    if (univB <= 3 && addrB >= 1 && addrB <= 512) {
      const univB2 = buffer.readUInt16LE(i + 4);
      const addrB2 = buffer.readUInt16LE(i + 6);
      if (univB2 <= 3 && addrB2 >= 1 && addrB2 <= 512) {
        // Check if addresses are sequential or have pattern
        if (addrB2 === addrB + 1 || addrB2 === addrB + 3) {
          matches.push({ offset: i, universe: univB, address: addrB, format: 'B' });
        }
      }
    }
  }

  // Group by offset range
  const byRange = new Map<number, typeof matches>();
  for (const m of matches) {
    const range = Math.floor(m.offset / 0x10000) * 0x10000;
    if (!byRange.has(range)) byRange.set(range, []);
    byRange.get(range)!.push(m);
  }

  for (const [range, items] of byRange) {
    if (items.length >= 5) {
      console.log(`Range 0x${range.toString(16)}:`);
      for (const item of items.slice(0, 5)) {
        console.log(`  0x${item.offset.toString(16)}: U${item.universe} A${item.address} (format ${item.format})`);
      }
      if (items.length > 5) {
        console.log(`  ... and ${items.length - 5} more in this range`);
      }
      // Dump first match context
      dumpHex(buffer, items[0].offset, 64);
      console.log('');
    }
  }
}

function searchAddressChannelPatterns(buffer: Buffer) {
  // Look for patterns: address (1-512), channel_count (1, 3, or similar)
  const matches: Array<{offset: number; address: number; channels: number}> = [];

  for (let i = 0; i < buffer.length - 8; i++) {
    const addr1 = buffer.readUInt16LE(i);
    const ch1 = buffer.readUInt16LE(i + 2);
    const addr2 = buffer.readUInt16LE(i + 4);
    const ch2 = buffer.readUInt16LE(i + 6);

    // Looking for: addr=1, ch=1, addr=2, ch=1 (sequential 1-channel fixtures)
    if (addr1 >= 1 && addr1 <= 512 && ch1 === 1 &&
        addr2 >= 1 && addr2 <= 512 && ch2 === 1 &&
        addr2 === addr1 + 1) {
      matches.push({ offset: i, address: addr1, channels: ch1 });
    }

    // Looking for: addr=1, ch=3, addr=4, ch=3 (sequential 3-channel fixtures)
    if (addr1 >= 1 && addr1 <= 512 && ch1 === 3 &&
        addr2 >= 1 && addr2 <= 512 && ch2 === 3 &&
        addr2 === addr1 + 3) {
      matches.push({ offset: i, address: addr1, channels: ch1 });
    }
  }

  console.log(`Found ${matches.length} address+channel patterns`);
  for (const m of matches.slice(0, 10)) {
    console.log(`  0x${m.offset.toString(16)}: A${m.address}, ${m.channels} channels`);
    dumpHex(buffer, m.offset, 32);
  }
}

function searchCombinedPatterns(buffer: Buffer) {
  // Search for 32-bit values where high 16 bits = universe, low 16 bits = address
  // Universe 0, addresses 1-100: 0x00000001 - 0x00000064
  // Universe 2, addresses 1,4,7...: 0x00020001, 0x00020004, 0x00020007

  const matches: Array<{offset: number; value: number; universe: number; address: number}> = [];

  for (let i = 0; i < buffer.length - 16; i++) {
    const v1 = buffer.readUInt32LE(i);
    const v2 = buffer.readUInt32LE(i + 4);

    const u1 = (v1 >> 16) & 0xFFFF;
    const a1 = v1 & 0xFFFF;
    const u2 = (v2 >> 16) & 0xFFFF;
    const a2 = v2 & 0xFFFF;

    // Check for sequential universe 0 addresses
    if (u1 === 0 && a1 >= 1 && a1 <= 100 && u2 === 0 && a2 === a1 + 1) {
      matches.push({ offset: i, value: v1, universe: u1, address: a1 });
    }

    // Check for universe 2, 3-channel spacing
    if (u1 === 2 && a1 >= 1 && a1 <= 300 && u2 === 2 && a2 === a1 + 3) {
      matches.push({ offset: i, value: v1, universe: u1, address: a1 });
    }
  }

  console.log(`Found ${matches.length} combined patterns`);
  for (const m of matches.slice(0, 10)) {
    console.log(`  0x${m.offset.toString(16)}: U${m.universe} A${m.address}`);
    dumpHex(buffer, m.offset, 32);
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

    console.log(`    0x${i.toString(16).padStart(8, '0')}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
