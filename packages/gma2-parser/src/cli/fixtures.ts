#!/usr/bin/env node
/**
 * CLI tool to extract and inspect fixtures from GMA2 show files
 */
import { loadShowFile } from '../binary/decompressor.js';
import {
  parseFixtureAtOffset,
  scanForFixtures,
  dumpFixtureRecord,
  KNOWN_FIXTURE_OFFSETS,
} from '../domain/fixture-extractor.js';
import { BinaryReader } from '../binary/reader.js';

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const command = args[1] || 'list';

  if (!filePath) {
    console.log('Usage: pnpm fixtures <show.show.gz> [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  list              List all fixtures found (default)');
    console.log('  dump <name>       Dump raw bytes for a fixture by name');
    console.log('  dump-offset <hex> Dump raw bytes at hex offset');
    console.log('  scan              Scan for fixture markers');
    console.log('  analyze           Analyze fixture record structure');
    process.exit(1);
  }

  console.log(`Loading ${filePath}...`);
  const buffer = await loadShowFile(filePath);
  console.log(`Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  switch (command) {
    case 'list':
      listFixtures(buffer);
      break;
    case 'dump':
      dumpFixture(buffer, args[2]);
      break;
    case 'dump-offset':
      dumpOffset(buffer, args[2]);
      break;
    case 'scan':
      scanFixtures(buffer);
      break;
    case 'analyze':
      analyzeFixtures(buffer);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

function listFixtures(buffer: Buffer) {
  console.log('Known fixture offsets:');
  console.log('='.repeat(70));

  for (const [name, offset] of Object.entries(KNOWN_FIXTURE_OFFSETS)) {
    const fixture = parseFixtureAtOffset(buffer, offset);
    if (fixture) {
      console.log(`${name.padEnd(20)} @ 0x${offset.toString(16).padStart(8, '0')}`);
      console.log(`  Name: ${fixture.name}`);
      console.log(`  Type ID: ${fixture.fixtureTypeId}`);
      console.log(`  Universe: ${fixture.universe}, Channel: ${fixture.startChannel}`);
      console.log(`  Raw attrs: ${fixture.rawAttributes?.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
      console.log('');
    } else {
      console.log(`${name.padEnd(20)} @ 0x${offset.toString(16).padStart(8, '0')} - PARSE FAILED`);
    }
  }
}

function dumpFixture(buffer: Buffer, name?: string) {
  if (!name) {
    console.log('Fixture names:');
    for (const n of Object.keys(KNOWN_FIXTURE_OFFSETS)) {
      console.log(`  ${n}`);
    }
    return;
  }

  const offset = KNOWN_FIXTURE_OFFSETS[name as keyof typeof KNOWN_FIXTURE_OFFSETS];
  if (!offset) {
    console.error(`Unknown fixture: ${name}`);
    console.log('Known fixtures:', Object.keys(KNOWN_FIXTURE_OFFSETS).join(', '));
    return;
  }

  console.log(dumpFixtureRecord(buffer, offset, 48, 96));
}

function dumpOffset(buffer: Buffer, hexOffset?: string) {
  if (!hexOffset) {
    console.error('Please provide hex offset (e.g., 0x27215)');
    return;
  }

  const offset = parseInt(hexOffset, 16);
  if (isNaN(offset)) {
    console.error(`Invalid hex offset: ${hexOffset}`);
    return;
  }

  console.log(dumpFixtureRecord(buffer, offset, 48, 128));
}

function scanFixtures(buffer: Buffer) {
  console.log('Scanning for fixture markers...');
  const fixtures = scanForFixtures(buffer, 0, Math.min(buffer.length, 0x02000000));

  console.log(`Found ${fixtures.length} fixtures:`);
  console.log('');

  for (const fixture of fixtures.slice(0, 50)) {
    console.log(`0x${fixture.offset.toString(16).padStart(8, '0')}: ${fixture.name}`);
    console.log(`  Type ID: ${fixture.fixtureTypeId}, Universe: ${fixture.universe}, Channel: ${fixture.startChannel}`);
  }

  if (fixtures.length > 50) {
    console.log(`... and ${fixtures.length - 50} more`);
  }
}

function analyzeFixtures(buffer: Buffer) {
  console.log('Analyzing fixture record structure...');
  console.log('');

  // Analyze each known fixture to understand the byte layout
  for (const [name, offset] of Object.entries(KNOWN_FIXTURE_OFFSETS)) {
    console.log(`=== ${name} @ 0x${offset.toString(16)} ===`);

    // Read extended context
    const contextStart = offset - 64;
    if (contextStart < 0) continue;

    const reader = new BinaryReader(buffer, contextStart);

    // Look for patterns in the header area
    console.log('Header analysis (-64 to 0):');

    // Read 16 4-byte values before name
    const values: number[] = [];
    for (let i = 0; i < 16; i++) {
      values.push(reader.readUInt32LE());
    }

    for (let i = 0; i < 16; i++) {
      const relOffset = (i - 16) * 4;
      const val = values[i];
      const hex = val.toString(16).padStart(8, '0');

      // Try to interpret the value
      let interpretation = '';
      if (val === 0) {
        interpretation = 'zero';
      } else if (val < 512) {
        interpretation = `possible channel (${val})`;
      } else if (val < 16) {
        interpretation = `possible universe (${val})`;
      } else if ((val & 0xffff0000) === 0 && (val & 0xffff) > 0 && (val & 0xffff) <= 512) {
        interpretation = `possible DMX addr (ch ${val & 0xffff})`;
      } else if (val === 0x5883b93e) {
        interpretation = 'MARKER (reversed)';
      } else if (val === 0x3eb98358) {
        interpretation = 'MARKER';
      }

      console.log(`  ${relOffset.toString().padStart(3)}: 0x${hex} (${val.toString().padStart(10)}) ${interpretation}`);
    }

    // Now read the fixture name
    reader.seek(offset);
    try {
      const fixtureName = reader.readNullTerminatedString(64);
      console.log(`Name: "${fixtureName}"`);

      // Read values after name
      console.log('Post-name values:');
      for (let i = 0; i < 16; i++) {
        const val = reader.readUInt32LE();
        const hex = val.toString(16).padStart(8, '0');
        console.log(`  +${((i + 1) * 4 + fixtureName.length).toString().padStart(3)}: 0x${hex} (${val})`);
      }
    } catch (e) {
      console.log(`Failed to read name: ${e}`);
    }

    console.log('');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
