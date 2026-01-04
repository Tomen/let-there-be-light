#!/usr/bin/env tsx
/**
 * Inspect MA DATA file structure
 *
 * Usage:
 *   pnpm gma2:inspect <file> [options]
 */

import { parseArgs } from 'node:util';
import { loadShowFile } from '../binary/decompressor.js';
import { parseHeader, formatVersion, formatTimestamp, versionBytesHex } from '../binary/header.js';
import {
  scanForRecords,
  findShowNames,
  getRecordTypeSummary,
} from '../binary/record-parser.js';
import type { MARecord } from '../binary/types.js';

function printRecord(record: MARecord, maxDepth: number, depth: number = 0): void {
  const indent = '  '.repeat(depth);
  const name = record.name || '<unnamed>';
  const typeHex = record.typeMarker.toString(16).padStart(2, '0');

  console.log(
    `${indent}[0x${record.offset.toString(16).padStart(8, '0')}] Type:0x${typeHex} Len:${record.length} "${name}"`
  );

  if (depth < maxDepth && record.children.length > 0) {
    for (const child of record.children) {
      printRecord(child, maxDepth, depth + 1);
    }
  }
}

export async function run(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      depth: { type: 'string', short: 'd', default: '2' },
      offset: { type: 'string', default: '0' },
      limit: { type: 'string', short: 'l', default: '100' },
      shows: { type: 'boolean', short: 's', default: false },
      types: { type: 'boolean', short: 't', default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
GMA2 Parser - Inspect File Structure

Usage:
  inspect <file> [options]

Options:
  -h, --help          Show this help
  -d, --depth <n>     Record depth to display (default: 2)
  -l, --limit <n>     Max records to scan (default: 100)
  --offset <n>        Start offset (default: 0)
  -s, --shows         Find show names
  -t, --types         Show record type summary

Examples:
  inspect show.show.gz                  # Basic inspection
  inspect show.show.gz -s               # Find show names
  inspect show.show.gz -t               # Record type summary
  inspect show.show.gz -d 3 -l 200      # Deep scan with more records
`);
    return;
  }

  const [filePath] = positionals;

  console.log(`Loading: ${filePath}\n`);

  const buffer = loadShowFile(filePath);
  const header = parseHeader(buffer);

  console.log('=== MA DATA File Structure ===\n');
  console.log(`Size: ${buffer.length.toLocaleString()} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  if (header) {
    console.log(`Version: ${formatVersion(header.version)}`);
    console.log(`Version bytes: ${versionBytesHex(header.version)}`);
    console.log(`Timestamp: ${formatTimestamp(header.timestamp)}`);
    console.log(`Header size: ${header.headerSize} bytes`);
  } else {
    console.log('WARNING: Invalid or missing MA DATA header');
  }
  console.log('');

  // Show names mode
  if (values.shows) {
    console.log('=== Show Names Found ===\n');
    const showNames = findShowNames(buffer);

    // Deduplicate and sort
    const uniqueNames = new Map<string, number>();
    for (const s of showNames) {
      if (!uniqueNames.has(s.name)) {
        uniqueNames.set(s.name, s.offset);
      }
    }

    const sorted = Array.from(uniqueNames.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    console.log(`Found ${sorted.length} unique show-like names:\n`);
    for (const [name, offset] of sorted) {
      console.log(`  0x${offset.toString(16).padStart(8, '0')}  ${name}`);
    }
    return;
  }

  // Record scanning
  const startOffset = values.offset.startsWith('0x')
    ? parseInt(values.offset, 16)
    : parseInt(values.offset, 10);

  const records = scanForRecords(buffer, {
    maxRecords: parseInt(values.limit),
    startOffset,
  });

  console.log(
    `Scanned ${records.length} records starting at 0x${startOffset.toString(16)}\n`
  );

  // Type summary mode
  if (values.types) {
    console.log('=== Record Type Summary ===\n');
    const summary = getRecordTypeSummary(records);

    const sortedTypes = Array.from(summary.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    for (const [type, info] of sortedTypes) {
      const typeHex = type.toString(16).padStart(2, '0');
      console.log(`Type 0x${typeHex}: ${info.count} records`);
      if (info.names.length > 0) {
        const nameList = info.names.slice(0, 5).join(', ');
        const more = info.names.length > 5 ? ` (+${info.names.length - 5} more)` : '';
        console.log(`  Names: ${nameList}${more}`);
      }
    }
    return;
  }

  // Normal record listing
  console.log('=== Records ===\n');
  const maxDepth = parseInt(values.depth);

  for (const record of records) {
    printRecord(record, maxDepth);
  }
}

// Run if executed directly
if (process.argv[1]?.includes('inspect')) {
  run(process.argv.slice(2)).catch(console.error);
}
