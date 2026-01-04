#!/usr/bin/env tsx
/**
 * Extract show data from MA DATA file to YAML
 *
 * Usage:
 *   pnpm gma2:extract <file> [show-name] [options]
 */

import { parseArgs } from 'node:util';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadShowFile } from '../binary/decompressor.js';
import { parseHeader, formatVersion } from '../binary/header.js';
import { scanForStrings } from '../binary/record-parser.js';
import { BinaryReader } from '../binary/reader.js';
import { FIXTURE_MARKER, scanForFixtures } from '../domain/fixture-extractor.js';
import { scanForGroups, extractUserGroups } from '../domain/group-extractor.js';
import type { ExtractedFixture, ExtractedFixtureType, ExtractedGroup, ExtractedShow } from '../domain/types.js';
import { generateFixturesYAML, generateFixtureModelsYAML, generateGroupsYAML, generateSummaryYAML, nameToId } from '../output/yaml-writer.js';

export async function run(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      output: { type: 'string', short: 'o', default: './data' },
      verbose: { type: 'boolean', short: 'v', default: false },
      dryrun: { type: 'boolean', short: 'n', default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
GMA2 Parser - Extract Show Data

Usage:
  extract <file> [show-name] [options]

Arguments:
  file       GMA2 show file (.show.gz or .show)
  show-name  Name of show to extract (used for output folder name)

Options:
  -h, --help          Show this help
  -o, --output <dir>  Output directory (default: ./data)
  -v, --verbose       Verbose output
  -n, --dryrun        Don't write files, just show what would be extracted

Examples:
  extract show.show.gz                          # Extract fixtures
  extract show.show.gz hillsong                 # Use 'hillsong' as show name
  extract show.show.gz -o ./output -v           # Verbose to custom dir

Output files:
  <output>/fixture-models.yaml           Fixture type definitions
  <output>/<show-name>/fixtures.yaml     Patched fixtures
  <output>/<show-name>/extraction.yaml   Extraction summary and notes

Notes:
  - DMX addresses cannot be automatically extracted from GMA2 files
  - You will need to manually set universe and startChannel values
  - Fixture type mappings may need manual verification
`);
    return;
  }

  const [filePath, showName = 'extracted-show'] = positionals;

  console.log(`Loading: ${filePath}`);

  // Load and decompress
  const buffer = await loadShowFile(filePath);
  console.log(`Decompressed: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Parse header
  const header = parseHeader(buffer);
  if (header) {
    console.log(`MA Version: ${formatVersion(header.version)}`);
  }
  console.log('');

  // Extract fixtures
  console.log('Scanning for fixtures...');
  const fixtures = await extractFixturesFromBuffer(buffer, values.verbose as boolean);
  console.log(`Found ${fixtures.length} fixtures`);

  // Extract fixture types from library
  console.log('Scanning for fixture types...');
  const fixtureTypes = await extractFixtureTypesFromBuffer(buffer, values.verbose as boolean);
  console.log(`Found ${fixtureTypes.length} fixture types`);

  // Extract groups
  console.log('Scanning for groups...');
  const allGroups = scanForGroups(buffer);
  const groups = extractUserGroups(allGroups);
  console.log(`Found ${allGroups.length} groups (${groups.length} user-defined)`);
  console.log('');

  // Build show data
  const show: ExtractedShow = {
    name: showName,
    offset: 0,
    fixtures,
    fixtureTypes,
    groups,
    presets: [],
  };

  // Generate output
  const fixturesYAML = generateFixturesYAML(fixtures);
  const modelsYAML = generateFixtureModelsYAML(fixtureTypes);
  const groupsYAML = generateGroupsYAML(groups);
  const summaryYAML = generateSummaryYAML(show);

  if (values.verbose) {
    console.log('=== Fixtures YAML Preview ===');
    console.log(fixturesYAML.slice(0, 1000));
    console.log('...');
    console.log('');
  }

  // Determine output paths
  const showDir = join(values.output as string, nameToId(showName));

  if (values.dryrun) {
    console.log('=== Dry Run - Would Create ===');
    console.log(`  ${values.output}/fixture-models.yaml (${fixtureTypes.length} types)`);
    console.log(`  ${showDir}/fixtures.yaml (${fixtures.length} fixtures)`);
    console.log(`  ${showDir}/groups.yaml (${groups.length} groups)`);
    console.log(`  ${showDir}/extraction.yaml (summary)`);
    console.log('');
    console.log('Use without --dryrun to write files.');
  } else {
    // Create directories
    if (!existsSync(values.output as string)) {
      mkdirSync(values.output as string, { recursive: true });
    }
    if (!existsSync(showDir)) {
      mkdirSync(showDir, { recursive: true });
    }

    // Write files
    writeFileSync(join(values.output as string, 'fixture-models.yaml'), modelsYAML);
    console.log(`Wrote: ${values.output}/fixture-models.yaml`);

    writeFileSync(join(showDir, 'fixtures.yaml'), fixturesYAML);
    console.log(`Wrote: ${showDir}/fixtures.yaml`);

    writeFileSync(join(showDir, 'extraction.yaml'), summaryYAML);
    console.log(`Wrote: ${showDir}/extraction.yaml`);

    // Write groups.yaml with extracted group names
    writeFileSync(join(showDir, 'groups.yaml'), groupsYAML);
    console.log(`Wrote: ${showDir}/groups.yaml (${groups.length} groups)`);

    // Create placeholder files for presets and graphs
    const emptyPresetsYAML = '# Presets - to be filled manually\n[]';
    const emptyGraphsYAML = '# Effect graphs\n[]';

    writeFileSync(join(showDir, 'presets.yaml'), emptyPresetsYAML);
    writeFileSync(join(showDir, 'graphs.yaml'), emptyGraphsYAML);
    console.log(`Wrote: ${showDir}/presets.yaml (placeholder)`);
    console.log(`Wrote: ${showDir}/graphs.yaml (placeholder)`);

    console.log('');
    console.log('IMPORTANT: DMX addresses could not be extracted.');
    console.log('Please edit fixtures.yaml to set correct universe and startChannel values.');
  }
}

/**
 * Extract fixtures from buffer
 */
async function extractFixturesFromBuffer(
  buffer: Buffer,
  verbose: boolean
): Promise<ExtractedFixture[]> {
  const fixtures: ExtractedFixture[] = [];
  const seen = new Set<string>();

  // Scan for fixture marker pattern
  const scanned = scanForFixtures(buffer, 0, Math.min(buffer.length, 0x02000000));

  for (const fixture of scanned) {
    // Skip duplicates
    if (seen.has(fixture.name)) continue;

    // Skip names that don't look like fixture names
    if (
      fixture.name.length < 2 ||
      fixture.name.length > 64 ||
      !/^[A-Za-z]/.test(fixture.name) ||
      fixture.name.includes('\x00')
    ) {
      continue;
    }

    seen.add(fixture.name);
    fixtures.push(fixture);

    if (verbose) {
      console.log(`  Found: ${fixture.name} @ 0x${fixture.offset.toString(16)}`);
    }
  }

  // Also scan for common fixture name patterns
  const strings = scanForStrings(buffer, 4, 64);
  const fixturePatterns = [
    /^Moving\s+\d+$/i,
    /^Wash\s+(Stage\s+)?\d+$/i,
    /^Spot\s+\d+$/i,
    /^Beam\s+\d+$/i,
    /^LED\s*(Par|Bar)\s*\d*$/i,
    /^Blinder\s*\d*$/i,
    /^Strobe\s*\d*$/i,
    /^Dimmer\s+\d+$/i,
    /^Par\s+\d+$/i,
    /^Front\s+(L|R|C|\d+)$/i,
    /^Back\s+(L|R|C|\d+)$/i,
    /^Side\s+(L|R|\d+)$/i,
  ];

  for (const s of strings) {
    if (seen.has(s.value)) continue;

    const isFixtureName = fixturePatterns.some((p) => p.test(s.value));
    if (!isFixtureName) continue;

    seen.add(s.value);
    fixtures.push({
      offset: s.offset,
      name: s.value,
      universe: 0,
      startChannel: 1,
      fixtureTypeId: 0,
    });

    if (verbose) {
      console.log(`  Found (pattern): ${s.value} @ 0x${s.offset.toString(16)}`);
    }
  }

  return fixtures;
}

/**
 * Extract fixture types from library section
 */
async function extractFixtureTypesFromBuffer(
  buffer: Buffer,
  verbose: boolean
): Promise<ExtractedFixtureType[]> {
  const types: ExtractedFixtureType[] = [];
  const seen = new Set<string>();

  // Known manufacturers to look for
  const manufacturers = [
    'Robe', 'Martin', 'Clay Paky', 'Chauvet', 'Elation', 'GLP',
    'Generic', 'Vari-Lite', 'High End', 'ETC', 'Ayrton', 'PR Lighting',
  ];

  const strings = scanForStrings(buffer, 4, 64);

  // Look for manufacturer names followed by model names
  for (let i = 0; i < strings.length - 1; i++) {
    const current = strings[i];
    const next = strings[i + 1];

    // Check if current string looks like a fixture model name
    // Model names are often in library area (offset > 0x500000)
    if (current.offset < 0x500000) continue;

    // Look for patterns like "Robin Pointe", "Mac 700 Profile"
    const modelPattern = /^(Robin|Mac|Rush|Impression|Sharpy|Mythos|Moving|Wash|Beam|Spot)\s+\d*\s*\w*/i;
    if (!modelPattern.test(current.value)) continue;

    const key = current.value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);

    // Try to determine manufacturer from context
    let manufacturer = 'Unknown';
    if (/robin/i.test(current.value)) manufacturer = 'Robe';
    else if (/mac|viper/i.test(current.value)) manufacturer = 'Martin';
    else if (/rush/i.test(current.value)) manufacturer = 'Elation';
    else if (/impression/i.test(current.value)) manufacturer = 'GLP';
    else if (/sharpy|mythos/i.test(current.value)) manufacturer = 'Clay Paky';

    types.push({
      id: types.length + 1,
      manufacturer,
      model: current.value,
      channelCount: 16, // Default estimate
    });

    if (verbose) {
      console.log(`  Found type: ${manufacturer} ${current.value}`);
    }
  }

  return types;
}

// Run if executed directly
if (process.argv[1]?.includes('extract')) {
  run(process.argv.slice(2)).catch(console.error);
}
