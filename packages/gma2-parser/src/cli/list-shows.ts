#!/usr/bin/env tsx
/**
 * List shows in a MA DATA file
 *
 * Usage:
 *   pnpm gma2:list <file>
 */

import { parseArgs } from 'node:util';
import { loadShowFile, getShowFileInfo } from '../binary/decompressor.js';
import { parseHeader, formatVersion } from '../binary/header.js';
import { findShowNames, scanForStrings } from '../binary/record-parser.js';

export interface ShowIndexEntry {
  name: string;
  offset: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract show index from buffer
 * This uses heuristics since the exact format is not yet known
 */
function extractShowIndex(buffer: Buffer): ShowIndexEntry[] {
  const strings = scanForStrings(buffer, 4, 128);
  const shows: ShowIndexEntry[] = [];
  const seen = new Set<string>();

  for (const s of strings) {
    const name = s.value;
    const lower = name.toLowerCase();

    // Skip obvious non-show strings
    if (
      lower.includes('\\') ||
      lower.includes('/') ||
      lower.includes('http') ||
      lower.includes('.dll') ||
      lower.includes('.exe') ||
      lower.includes('.xml') ||
      lower.includes('.xsd') ||
      lower.includes('programdata') ||
      lower.includes('malighting') ||
      seen.has(lower)
    ) {
      continue;
    }

    // Check for show-like patterns
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (
      lower.includes('show') ||
      lower.includes('backup') ||
      lower.includes('_v') ||
      lower.match(/201\d/) ||
      lower.match(/202\d/) ||
      lower.match(/2k\d\d/)
    ) {
      confidence = 'high';
    } else if (
      name.includes('_') &&
      name.length > 8 &&
      /^[a-zA-Z0-9_-]+$/.test(name)
    ) {
      confidence = 'medium';
    }

    if (confidence !== 'low') {
      shows.push({ name, offset: s.offset, confidence });
      seen.add(lower);
    }
  }

  // Sort by offset
  shows.sort((a, b) => a.offset - b.offset);

  return shows;
}

export async function run(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      all: { type: 'boolean', short: 'a', default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
GMA2 Parser - List Shows

Usage:
  list <file> [options]

Options:
  -h, --help    Show this help
  -a, --all     Show all matches including low confidence

Examples:
  list show.show.gz        # List shows in file
  list show.show.gz -a     # Include low-confidence matches
`);
    return;
  }

  const [filePath] = positionals;

  console.log(`Loading: ${filePath}`);

  // Show file info
  const info = getShowFileInfo(filePath);
  console.log(`Compressed: ${info.isCompressed ? 'Yes' : 'No'}`);
  console.log(`Size: ${(info.compressedSize / 1024 / 1024).toFixed(2)} MB`);

  // Load and decompress
  const buffer = loadShowFile(filePath);
  console.log(`Decompressed: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Parse header
  const header = parseHeader(buffer);
  if (header) {
    console.log(`MA Version: ${formatVersion(header.version)}`);
    console.log('');
  }

  // Find shows
  const shows = extractShowIndex(buffer);

  // Filter by confidence
  const filtered = values.all
    ? shows
    : shows.filter((s) => s.confidence !== 'low');

  console.log(`Found ${filtered.length} show(s):`);
  console.log('');

  let index = 0;
  for (const show of filtered) {
    const confidenceIcon =
      show.confidence === 'high' ? '*' : show.confidence === 'medium' ? '~' : '?';
    console.log(`  [${index}] ${confidenceIcon} ${show.name}`);
    console.log(`      Offset: 0x${show.offset.toString(16)}`);
    index++;
  }

  console.log('');
  console.log('Legend: * = high confidence, ~ = medium, ? = low');
  console.log('');
  console.log('Use "extract <file> <name>" to extract a show');
}

// Run if executed directly
if (process.argv[1]?.includes('list-shows')) {
  run(process.argv.slice(2)).catch(console.error);
}
