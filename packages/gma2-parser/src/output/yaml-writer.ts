/**
 * YAML output generation for extracted GMA2 data
 */
import yaml from 'js-yaml';
import type { ExtractedFixture, ExtractedFixtureType, ExtractedGroup, ExtractedShow } from '../domain/types.js';

interface FixtureModelYAML {
  id: string;
  brand: string;
  model: string;
  channels: Record<string, number>;
  revision: number;
}

interface FixtureYAML {
  id: string;
  name: string;
  modelId: string;
  universe: number;
  startChannel: number;
  revision: number;
}

interface GroupYAML {
  id: string;
  name: string;
  fixtureIds: string[];
  revision: number;
}

/**
 * Convert fixture name to a URL-safe ID
 */
export function nameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate fixtures.yaml content
 */
export function generateFixturesYAML(fixtures: ExtractedFixture[]): string {
  const yamlFixtures: FixtureYAML[] = fixtures.map((f, index) => ({
    id: nameToId(f.name),
    name: f.name,
    modelId: 'unknown', // TODO: resolve from fixture type library
    universe: f.universe,
    startChannel: f.startChannel || (index + 1), // Placeholder if unknown
    revision: 1,
  }));

  return yaml.dump(yamlFixtures, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}

/**
 * Generate fixture-models.yaml content
 */
export function generateFixtureModelsYAML(types: ExtractedFixtureType[]): string {
  const yamlModels: FixtureModelYAML[] = types.map((t) => ({
    id: nameToId(`${t.manufacturer}-${t.model}`),
    brand: t.manufacturer,
    model: t.model,
    channels: t.channels
      ? Object.fromEntries(t.channels.map((ch, i) => [ch.toLowerCase(), i + 1]))
      : { dimmer: 1 },
    revision: 1,
  }));

  return yaml.dump(yamlModels, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}

/**
 * Generate groups.yaml content
 */
export function generateGroupsYAML(groups: ExtractedGroup[]): string {
  const yamlGroups: GroupYAML[] = groups.map((g) => ({
    id: nameToId(g.name),
    name: g.name,
    fixtureIds: [], // Cannot be automatically extracted - user must fill in
    revision: 1,
  }));

  // Add header comment
  const header = `# Groups extracted from GrandMA2 show file
# NOTE: fixtureIds must be filled in manually - group membership cannot be reliably extracted
`;

  return header + yaml.dump(yamlGroups, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}

/**
 * Generate a summary YAML with all extracted data
 */
export function generateSummaryYAML(show: ExtractedShow): string {
  const summary = {
    showName: show.name,
    extractedAt: new Date().toISOString(),
    fixtures: show.fixtures.map((f) => ({
      name: f.name,
      id: nameToId(f.name),
      offset: `0x${f.offset.toString(16)}`,
      universe: f.universe,
      startChannel: f.startChannel,
      fixtureTypeId: f.fixtureTypeId,
      // Mark as needing manual verification
      dmxNeedsVerification: f.startChannel === 1 && f.universe === 0,
    })),
    fixtureTypes: show.fixtureTypes.map((t) => ({
      manufacturer: t.manufacturer,
      model: t.model,
      channelCount: t.channelCount,
    })),
    statistics: {
      fixtureCount: show.fixtures.length,
      fixtureTypeCount: show.fixtureTypes.length,
      groupCount: show.groups.length,
      presetCount: show.presets.length,
    },
    notes: [
      'DMX addresses could not be automatically extracted from this show file.',
      'Please verify universe and startChannel values for each fixture.',
      'Fixture type mappings may need manual verification.',
    ],
  };

  return yaml.dump(summary, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}
