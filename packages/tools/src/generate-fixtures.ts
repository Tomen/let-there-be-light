#!/usr/bin/env tsx
/**
 * Fixture Generator
 *
 * Utility to generate and manage fixture entries and groups for fixtures.yaml
 *
 * Usage:
 *   npm run generate fixtures <model> <universe> <count> <startChannel> <namePrefix>
 *   npm run generate group <groupName> <fixturePattern>
 *   npm run generate remove fixtures <pattern>
 *   npm run generate remove group <groupName>
 *
 * Examples:
 *   npm run generate fixtures generic-rgbw 0 20 1 wash
 *     → Creates wash-1 through wash-20, channels 1-80
 *
 *   npm run generate group front-wash "wash-1,wash-2,wash-3"
 *     → Creates group "front-wash" with those fixtures
 *
 *   npm run generate group all-wash "wash-*"
 *     → Creates group "all-wash" with all wash-N fixtures
 *
 *   npm run generate remove fixtures "wash-*"
 *     → Removes all fixtures starting with "wash-"
 *
 *   npm run generate remove group front-wash
 *     → Removes the group "front-wash"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = join(__dirname, '..', 'fixtures.yaml');

interface ChannelMap {
  [key: string]: number;
}

interface FixtureModel {
  brand: string;
  model: string;
  channels: ChannelMap;
}

interface FixtureDefinition {
  name: string;
  model: string;
  universe: number;
  startChannel: number;
}

interface FixturesYaml {
  models: Record<string, FixtureModel>;
  fixtures: FixtureDefinition[];
  groups: Record<string, string[]>;
}

function loadFixtures(): FixturesYaml {
  if (!existsSync(fixturesPath)) {
    return { models: {}, fixtures: [], groups: {} };
  }
  const content = readFileSync(fixturesPath, 'utf8');
  return yaml.load(content) as FixturesYaml;
}

function saveFixtures(data: FixturesYaml): void {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  writeFileSync(fixturesPath, content, 'utf8');
}

function getChannelCount(model: FixtureModel): number {
  const offsets = Object.values(model.channels);
  return Math.max(...offsets);
}

function generateFixtures(
  modelName: string,
  universe: number,
  count: number,
  startChannel: number,
  namePrefix: string
): void {
  const data = loadFixtures();

  // Validate model exists
  const model = data.models[modelName];
  if (!model) {
    console.error(`Error: Model "${modelName}" not found in fixtures.yaml`);
    console.error(`Available models: ${Object.keys(data.models).join(', ')}`);
    process.exit(1);
  }

  const channelCount = getChannelCount(model);
  const newFixtures: FixtureDefinition[] = [];

  let currentChannel = startChannel;
  for (let i = 1; i <= count; i++) {
    const name = `${namePrefix}-${i}`;

    // Check if fixture already exists
    if (data.fixtures.some((f) => f.name === name)) {
      console.warn(`Warning: Fixture "${name}" already exists, skipping`);
      currentChannel += channelCount;
      continue;
    }

    newFixtures.push({
      name,
      model: modelName,
      universe,
      startChannel: currentChannel,
    });

    currentChannel += channelCount;
  }

  if (newFixtures.length === 0) {
    console.log('No new fixtures to add');
    return;
  }

  data.fixtures.push(...newFixtures);
  saveFixtures(data);

  console.log(`Created ${newFixtures.length} fixtures:`);
  for (const f of newFixtures) {
    console.log(`  ${f.name} - universe ${f.universe}, ch ${f.startChannel}-${f.startChannel + channelCount - 1}`);
  }
  console.log(`\nTotal channels used: ${newFixtures.length * channelCount} (${startChannel}-${currentChannel - 1})`);
}

function generateGroup(groupName: string, fixturePattern: string): void {
  const data = loadFixtures();

  // Check if group already exists
  if (data.groups[groupName]) {
    console.error(`Error: Group "${groupName}" already exists`);
    process.exit(1);
  }

  let fixtureNames: string[];

  if (fixturePattern.includes('*')) {
    // Wildcard pattern - match fixtures
    const prefix = fixturePattern.replace('*', '');
    fixtureNames = data.fixtures
      .filter((f) => f.name.startsWith(prefix))
      .map((f) => f.name)
      .sort((a, b) => {
        // Sort numerically if they end with numbers
        const numA = parseInt(a.match(/-(\d+)$/)?.[1] || '0');
        const numB = parseInt(b.match(/-(\d+)$/)?.[1] || '0');
        return numA - numB;
      });
  } else {
    // Explicit list
    fixtureNames = fixturePattern.split(',').map((n) => n.trim());
  }

  // Validate all fixtures exist
  const missing = fixtureNames.filter((name) => !data.fixtures.some((f) => f.name === name));
  if (missing.length > 0) {
    console.error(`Error: Unknown fixtures: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (fixtureNames.length === 0) {
    console.error('Error: No fixtures matched the pattern');
    process.exit(1);
  }

  data.groups[groupName] = fixtureNames;
  saveFixtures(data);

  console.log(`Created group "${groupName}" with ${fixtureNames.length} fixtures:`);
  console.log(`  ${fixtureNames.join(', ')}`);
}

function removeFixtures(pattern: string): void {
  const data = loadFixtures();

  let fixturesToRemove: string[];

  if (pattern.includes('*')) {
    // Wildcard pattern
    const prefix = pattern.replace('*', '');
    fixturesToRemove = data.fixtures
      .filter((f) => f.name.startsWith(prefix))
      .map((f) => f.name);
  } else {
    // Explicit list or single fixture
    fixturesToRemove = pattern.split(',').map((n) => n.trim());
  }

  if (fixturesToRemove.length === 0) {
    console.error('Error: No fixtures matched the pattern');
    process.exit(1);
  }

  // Check which fixtures actually exist
  const existing = fixturesToRemove.filter((name) => data.fixtures.some((f) => f.name === name));
  if (existing.length === 0) {
    console.error('Error: None of the specified fixtures exist');
    process.exit(1);
  }

  // Remove fixtures
  const originalCount = data.fixtures.length;
  data.fixtures = data.fixtures.filter((f) => !existing.includes(f.name));
  const removedCount = originalCount - data.fixtures.length;

  // Also remove from any groups that reference them
  let groupsModified = 0;
  for (const [groupName, members] of Object.entries(data.groups)) {
    const filtered = members.filter((name) => !existing.includes(name));
    if (filtered.length !== members.length) {
      groupsModified++;
      if (filtered.length === 0) {
        // Remove empty group
        delete data.groups[groupName];
        console.log(`  Removed empty group "${groupName}"`);
      } else {
        data.groups[groupName] = filtered;
      }
    }
  }

  saveFixtures(data);

  console.log(`Removed ${removedCount} fixtures:`);
  for (const name of existing) {
    console.log(`  ${name}`);
  }
  if (groupsModified > 0) {
    console.log(`\nUpdated ${groupsModified} group(s) that referenced removed fixtures`);
  }
}

function removeGroup(groupName: string): void {
  const data = loadFixtures();

  if (!data.groups[groupName]) {
    console.error(`Error: Group "${groupName}" does not exist`);
    console.error(`Available groups: ${Object.keys(data.groups).join(', ') || '(none)'}`);
    process.exit(1);
  }

  const memberCount = data.groups[groupName].length;
  delete data.groups[groupName];
  saveFixtures(data);

  console.log(`Removed group "${groupName}" (had ${memberCount} fixtures)`);
  console.log('Note: Fixtures themselves were not removed, only the group');
}

function showHelp(): void {
  console.log(`
Fixture Generator - Create and manage fixtures and groups for fixtures.yaml

Usage:
  npm run generate fixtures <model> <universe> <count> <startChannel> <namePrefix>
  npm run generate group <groupName> <fixturePattern>
  npm run generate remove fixtures <pattern>
  npm run generate remove group <groupName>

Commands:
  fixtures         Generate multiple fixtures of the same model in sequence
  group            Create a group from fixtures
  remove fixtures  Remove fixtures matching a pattern
  remove group     Remove a group (keeps fixtures)

Arguments for 'fixtures':
  model         Model name from fixtures.yaml (e.g., generic-rgbw)
  universe      Universe number (0-32767)
  count         Number of fixtures to create
  startChannel  First DMX channel (1-512)
  namePrefix    Prefix for fixture names (creates prefix-1, prefix-2, etc.)

Arguments for 'group':
  groupName       Name for the new group
  fixturePattern  Comma-separated list OR wildcard pattern
                  Examples: "wash-1,wash-2,wash-3" or "wash-*"

Arguments for 'remove fixtures':
  pattern         Fixture name, comma-separated list, or wildcard pattern
                  Examples: "wash-1", "wash-1,wash-2", or "wash-*"

Arguments for 'remove group':
  groupName       Name of the group to remove

Examples:
  npm run generate fixtures generic-rgbw 0 20 1 wash
    → Creates wash-1 through wash-20, using channels 1-80

  npm run generate group all-wash "wash-*"
    → Creates group with all fixtures starting with "wash-"

  npm run generate remove fixtures "wash-*"
    → Removes all fixtures starting with "wash-" (and updates groups)

  npm run generate remove group all-wash
    → Removes the group "all-wash" (fixtures remain)
`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'fixtures': {
    const [, modelName, universeStr, countStr, startChannelStr, namePrefix] = args;

    if (!modelName || !universeStr || !countStr || !startChannelStr || !namePrefix) {
      console.error('Error: Missing arguments');
      console.error('Usage: npm run generate fixtures <model> <universe> <count> <startChannel> <namePrefix>');
      process.exit(1);
    }

    const universe = parseInt(universeStr, 10);
    const count = parseInt(countStr, 10);
    const startChannel = parseInt(startChannelStr, 10);

    if (isNaN(universe) || universe < 0) {
      console.error('Error: Invalid universe number');
      process.exit(1);
    }
    if (isNaN(count) || count < 1) {
      console.error('Error: Count must be at least 1');
      process.exit(1);
    }
    if (isNaN(startChannel) || startChannel < 1 || startChannel > 512) {
      console.error('Error: Start channel must be 1-512');
      process.exit(1);
    }

    generateFixtures(modelName, universe, count, startChannel, namePrefix);
    break;
  }

  case 'group': {
    const [, groupName, fixturePattern] = args;

    if (!groupName || !fixturePattern) {
      console.error('Error: Missing arguments');
      console.error('Usage: npm run generate group <groupName> <fixturePattern>');
      process.exit(1);
    }

    generateGroup(groupName, fixturePattern);
    break;
  }

  case 'remove': {
    const subCommand = args[1];
    const target = args[2];

    if (subCommand === 'fixtures') {
      if (!target) {
        console.error('Error: Missing pattern');
        console.error('Usage: npm run generate remove fixtures <pattern>');
        process.exit(1);
      }
      removeFixtures(target);
    } else if (subCommand === 'group') {
      if (!target) {
        console.error('Error: Missing group name');
        console.error('Usage: npm run generate remove group <groupName>');
        process.exit(1);
      }
      removeGroup(target);
    } else {
      console.error('Error: remove requires "fixtures" or "group"');
      console.error('Usage: npm run generate remove fixtures <pattern>');
      console.error('       npm run generate remove group <groupName>');
      process.exit(1);
    }
    break;
  }

  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
    }
    showHelp();
    process.exit(command ? 1 : 0);
}
