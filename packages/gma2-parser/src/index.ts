/**
 * @let-there-be-light/gma2-parser
 *
 * GrandMA2 show file parser for Let There Be Light
 *
 * This package provides tools for reverse-engineering and extracting data
 * from GrandMA2 .show.gz files.
 */

// Binary types
export type {
  MADataHeader,
  MAVersion,
  MARecord,
  ParseContext,
  ParseError,
  ShowFileInfo,
} from './binary/types.js';

export { RecordType } from './binary/types.js';

// Binary reader
export { BinaryReader } from './binary/reader.js';

// Decompressor
export { loadShowFile, getShowFileInfo, decompressBuffer } from './binary/decompressor.js';

// Header parsing
export {
  parseHeader,
  isValidMAData,
  formatVersion,
  formatTimestamp,
  versionBytesHex,
} from './binary/header.js';

// Record parsing
export {
  createParseContext,
  scanForStrings,
  scanForRecords,
  findRecordsByName,
  findShowNames,
  parseRecord,
  getRecordTypeSummary,
} from './binary/record-parser.js';

// Domain types
export type {
  ExtractedFixture,
  ExtractedFixtureType,
  ExtractedGroup,
  ExtractedPreset,
  ExtractedShow,
} from './domain/types.js';

// Fixture extraction
export {
  FIXTURE_MARKER,
  KNOWN_FIXTURE_OFFSETS,
  parseFixtureAtOffset,
  scanForFixtures,
  dumpFixtureRecord,
  extractFixtures,
} from './domain/fixture-extractor.js';

// Group extraction
export {
  scanForGroups,
  extractUserGroups,
} from './domain/group-extractor.js';

// Output generation
export {
  nameToId,
  generateFixturesYAML,
  generateFixtureModelsYAML,
  generateGroupsYAML,
  generateSummaryYAML,
} from './output/yaml-writer.js';
