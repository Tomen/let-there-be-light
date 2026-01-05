#!/usr/bin/env node
/**
 * Deep search for DMX addresses, groups, and presets
 */
import { loadShowFile } from '../binary/decompressor.js';
import { BinaryReader } from '../binary/reader.js';
import { scanForStrings } from '../binary/record-parser.js';

async function main() {
  const filePath = process.argv[2];
  const mode = process.argv[3] || 'all';

  if (!filePath) {
    console.log('Usage: pnpm deep-search <show.show.gz> [mode]');
    console.log('');
    console.log('Modes:');
    console.log('  all       Run all searches (default)');
    console.log('  dmx       Search for DMX/patch data');
    console.log('  groups    Search for group structures');
    console.log('  presets   Search for preset data');
    console.log('  index     Analyze show index area');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  if (mode === 'all' || mode === 'dmx') {
    await searchDMX(buffer);
  }
  if (mode === 'all' || mode === 'groups') {
    await searchGroups(buffer);
  }
  if (mode === 'all' || mode === 'presets') {
    await searchPresets(buffer);
  }
  if (mode === 'all' || mode === 'index') {
    await analyzeShowIndex(buffer);
  }
}

async function searchDMX(buffer: Buffer) {
  console.log('=== DMX/Patch Search ===\n');

  // Search for DMX-related strings
  const strings = scanForStrings(buffer, 3, 64);
  const dmxStrings = strings.filter(s => {
    const lower = s.value.toLowerCase();
    return lower.includes('dmx') ||
           lower.includes('patch') ||
           lower.includes('universe') ||
           lower.includes('address') ||
           lower.includes('channel') ||
           lower.includes('output');
  });

  console.log('DMX-related strings found:');
  const seen = new Set<string>();
  for (const s of dmxStrings) {
    if (seen.has(s.value)) continue;
    seen.add(s.value);
    console.log(`  0x${s.offset.toString(16).padStart(8, '0')}: "${s.value}"`);
  }
  console.log('');

  // Look for the value 0x123 (291) that appears in fixture headers
  // This might lead us to a patch table
  console.log('Searching for fixture header marker (0x123)...');
  let count = 0;
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer.readUInt32LE(i) === 0x123) {
      // Check if this looks like a fixture header
      const next4 = i + 4 < buffer.length ? buffer.readUInt32LE(i + 4) : 0;
      if (next4 > 0x8000 && next4 < 0x500000) {
        // Looks like a pointer
        console.log(`  0x${i.toString(16)}: marker 0x123, next ptr 0x${next4.toString(16)}`);
        count++;
        if (count >= 20) {
          console.log('  ... (more matches)');
          break;
        }
      }
    }
  }
  console.log('');

  // Search for patterns that could be DMX addresses
  // Looking for: small_number (1-20) followed by 0 or 1 (universe) followed by 1-512 (address)
  console.log('Searching for potential fixture ID → address mappings...');

  // Try to find a table structure
  for (let i = 0x8000; i < Math.min(buffer.length - 32, 0x100000); i++) {
    // Look for: u32 fixture_id (1-50), u32 something, pattern continues
    const id1 = buffer.readUInt32LE(i);
    const id2 = buffer.readUInt32LE(i + 8);
    const id3 = buffer.readUInt32LE(i + 16);

    if (id1 >= 1 && id1 <= 50 &&
        id2 === id1 + 1 &&
        id3 === id1 + 2) {
      console.log(`  Potential ID sequence at 0x${i.toString(16)}: ${id1}, ${id2}, ${id3}...`);

      // Dump the area
      const reader = new BinaryReader(buffer, i);
      for (let j = 0; j < 5 && reader.remaining() > 8; j++) {
        const id = reader.readUInt32LE();
        const val = reader.readUInt32LE();
        console.log(`    ID ${id}: value 0x${val.toString(16)} (${val})`);
      }
      console.log('');
    }
  }
}

async function searchGroups(buffer: Buffer) {
  console.log('=== Group Search ===\n');

  const strings = scanForStrings(buffer, 4, 64);

  // Find group-related strings
  const groupStrings = strings.filter(s =>
    s.value.toLowerCase().includes('group') ||
    s.value.startsWith('All ') ||
    s.value.match(/^(Front|Back|Side|Stage|Wash|Beam|Spot)\s/i)
  );

  const seen = new Set<string>();
  const groups: Array<{offset: number; name: string}> = [];

  for (const s of groupStrings) {
    if (seen.has(s.value)) continue;
    if (s.value.length > 40) continue; // Skip long strings
    seen.add(s.value);
    groups.push({ offset: s.offset, name: s.value });
  }

  console.log(`Found ${groups.length} potential group names:`);

  // Show first 30
  for (const g of groups.slice(0, 30)) {
    console.log(`  0x${g.offset.toString(16).padStart(8, '0')}: "${g.name}"`);
  }

  if (groups.length > 30) {
    console.log(`  ... and ${groups.length - 30} more`);
  }
  console.log('');

  // Analyze a specific group entry
  const allRobin = groups.find(g => g.name.includes('All Robin100'));
  if (allRobin) {
    console.log(`Analyzing "All Robin100" group at 0x${allRobin.offset.toString(16)}:`);
    dumpContext(buffer, allRobin.offset, 64, 128);
  }
  console.log('');
}

async function searchPresets(buffer: Buffer) {
  console.log('=== Preset Search ===\n');

  const strings = scanForStrings(buffer, 4, 64);

  // Find color preset strings
  const colorNames = ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow',
                      'amber', 'white', 'orange', 'pink', 'uv', 'congo'];

  const presetStrings = strings.filter(s => {
    const lower = s.value.toLowerCase();
    return colorNames.some(c => lower.includes(c)) ||
           lower.includes('preset') ||
           lower.includes('color');
  });

  const seen = new Set<string>();
  const presets: Array<{offset: number; name: string}> = [];

  for (const s of presetStrings) {
    if (seen.has(s.value)) continue;
    if (s.value.length > 40) continue;
    // Skip fixture library entries
    if (s.offset > 0x900000 && s.offset < 0xA00000) continue;
    seen.add(s.value);
    presets.push({ offset: s.offset, name: s.value });
  }

  console.log(`Found ${presets.length} potential preset names:`);

  for (const p of presets.slice(0, 30)) {
    console.log(`  0x${p.offset.toString(16).padStart(8, '0')}: "${p.name}"`);
  }

  if (presets.length > 30) {
    console.log(`  ... and ${presets.length - 30} more`);
  }
  console.log('');

  // Look for color values (RGB bytes)
  // Colors in GMA2 might be stored as 0-255 RGB values
  const redPreset = presets.find(p => p.name.toLowerCase() === 'red');
  if (redPreset) {
    console.log(`Analyzing "Red" preset at 0x${redPreset.offset.toString(16)}:`);
    dumpContext(buffer, redPreset.offset, 32, 64);

    // Look for 0xFF 0x00 0x00 pattern (Red in RGB)
    const reader = new BinaryReader(buffer, redPreset.offset - 32);
    for (let i = 0; i < 96 && reader.hasMore(); i++) {
      const pos = reader.position;
      const b1 = reader.readUInt8();
      if (b1 === 0xFF && reader.remaining() >= 2) {
        const b2 = reader.peekBytes(2);
        if (b2[0] === 0x00 && b2[1] === 0x00) {
          console.log(`  Potential RGB (255,0,0) at 0x${pos.toString(16)}`);
        }
      }
    }
  }
  console.log('');
}

async function analyzeShowIndex(buffer: Buffer) {
  console.log('=== Show Index Analysis ===\n');

  // The show entry "hillsong_september14" is at 0x2494
  const showOffset = 0x2494;

  console.log('Show index area (0x2400 - 0x2800):');
  dumpContext(buffer, showOffset, 0x94, 0x300);
  console.log('');

  // Look for structure that might reference fixture patch
  console.log('Analyzing show index structure...');
  const reader = new BinaryReader(buffer, 0x2400);

  // Read and interpret values
  while (reader.position < 0x2800) {
    const pos = reader.position;
    const val = reader.readUInt32LE();

    // Look for interesting values
    if (val > 0x8000 && val < buffer.length) {
      // Could be a pointer
      // Check what's at that location
      const targetReader = new BinaryReader(buffer, val);
      try {
        const peek = targetReader.peekBytes(4);
        const peekStr = peek.toString('ascii').replace(/[\x00-\x1F\x7F-\xFF]/g, '.');
        console.log(`  0x${pos.toString(16)}: ptr 0x${val.toString(16)} -> "${peekStr}..."`);
      } catch {
        // Ignore errors
      }
    }
  }
  console.log('');
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
    console.log(`  ${relStr.padStart(5)}  ${hex.join(' ').padEnd(47)}  ${ascii.join('')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
