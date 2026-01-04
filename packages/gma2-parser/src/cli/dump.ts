#!/usr/bin/env tsx
/**
 * Hex dump utility for analyzing MA DATA files
 *
 * Usage:
 *   pnpm gma2:dump <file> [offset] [length]
 *   pnpm gma2:dump show.show.gz 0x1000 512
 */

import { parseArgs } from 'node:util';
import { loadShowFile, getShowFileInfo } from '../binary/decompressor.js';
import { parseHeader, formatVersion, formatTimestamp } from '../binary/header.js';

function hexDump(buffer: Buffer, offset: number, length: number): void {
  const end = Math.min(offset + length, buffer.length);

  for (let i = offset; i < end; i += 16) {
    const hex: string[] = [];
    const ascii: string[] = [];

    for (let j = 0; j < 16 && i + j < end; j++) {
      const byte = buffer[i + j];
      hex.push(byte.toString(16).padStart(2, '0'));
      ascii.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }

    const addr = i.toString(16).padStart(8, '0');
    const hexStr = hex.join(' ').padEnd(48);
    console.log(`${addr}  ${hexStr} |${ascii.join('')}|`);
  }
}

function parseOffset(value: string): number {
  if (value.startsWith('0x') || value.startsWith('0X')) {
    return parseInt(value, 16);
  }
  return parseInt(value, 10);
}

export async function run(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      strings: { type: 'boolean', short: 's', default: false },
      header: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
GMA2 Parser - Hex Dump

Usage:
  dump <file> [offset] [length]

Arguments:
  file      GMA2 show file (.show.gz or .show)
  offset    Start offset (decimal or 0x hex, default: 0)
  length    Number of bytes to dump (default: 256)

Options:
  -h, --help     Show this help
  -s, --strings  Scan for strings instead of hex dump
  --header       Show file header information

Examples:
  dump show.show.gz                    # Dump first 256 bytes
  dump show.show.gz 0x1000 512         # Dump 512 bytes at offset 0x1000
  dump show.show.gz --header           # Show header info
  dump show.show.gz -s                 # Scan for strings
`);
    return;
  }

  const [filePath, offsetArg, lengthArg] = positionals;

  console.log(`Loading: ${filePath}`);

  // Show file info
  const info = getShowFileInfo(filePath);
  console.log(`Compressed: ${info.isCompressed ? 'Yes' : 'No'}`);
  console.log(`Size: ${(info.compressedSize / 1024 / 1024).toFixed(2)} MB`);

  // Load and decompress
  const buffer = loadShowFile(filePath);
  console.log(`Decompressed: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Show header if requested
  if (values.header) {
    const header = parseHeader(buffer);
    if (header) {
      console.log('=== MA DATA Header ===');
      console.log(`Magic: ${JSON.stringify(header.magic)}`);
      console.log(`Version: ${formatVersion(header.version)}`);
      console.log(`Version bytes: ${header.version.raw.toString('hex')}`);
      console.log(`Timestamp: ${formatTimestamp(header.timestamp)}`);
      console.log(`Header size: ${header.headerSize} bytes`);
      console.log('');
    } else {
      console.log('WARNING: Invalid MA DATA header');
      console.log('');
    }
  }

  // String scan mode
  if (values.strings) {
    console.log('=== String Scan ===');
    const { scanForStrings } = await import('../binary/record-parser.js');
    const strings = scanForStrings(buffer, 8, 128);

    // Group by patterns
    const showLike: typeof strings = [];
    const pathLike: typeof strings = [];
    const other: typeof strings = [];

    for (const s of strings) {
      const lower = s.value.toLowerCase();
      if (lower.includes('\\') || lower.includes('/')) {
        pathLike.push(s);
      } else if (
        !lower.includes('http') &&
        !lower.includes('.dll') &&
        !lower.includes('.exe')
      ) {
        showLike.push(s);
      } else {
        other.push(s);
      }
    }

    console.log(`\nFound ${strings.length} strings (${showLike.length} show-like, ${pathLike.length} paths)\n`);

    console.log('--- Show-like names (first 50) ---');
    for (const s of showLike.slice(0, 50)) {
      console.log(`  0x${s.offset.toString(16).padStart(8, '0')}  ${s.value}`);
    }

    console.log('\n--- File paths (first 20) ---');
    for (const s of pathLike.slice(0, 20)) {
      console.log(`  0x${s.offset.toString(16).padStart(8, '0')}  ${s.value}`);
    }
    return;
  }

  // Normal hex dump
  const offset = offsetArg ? parseOffset(offsetArg) : 0;
  const length = lengthArg ? parseInt(lengthArg, 10) : 256;

  console.log(`=== Hex Dump: offset 0x${offset.toString(16)}, length ${length} ===`);
  console.log('');
  hexDump(buffer, offset, length);
}

// Run if executed directly
if (process.argv[1]?.includes('dump')) {
  run(process.argv.slice(2)).catch(console.error);
}
