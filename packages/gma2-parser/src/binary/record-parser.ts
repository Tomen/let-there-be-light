import { BinaryReader } from './reader.js';
import type { MARecord, ParseContext, ParseError } from './types.js';

/**
 * Create a new parse context
 */
export function createParseContext(buffer: Buffer, offset: number = 0): ParseContext {
  return {
    buffer,
    offset,
    errors: [],
    path: [],
  };
}

/**
 * Scan buffer for strings (useful for initial discovery)
 */
export function scanForStrings(
  buffer: Buffer,
  minLength: number = 4,
  maxLength: number = 256
): Array<{ offset: number; value: string }> {
  const results: Array<{ offset: number; value: string }> = [];
  let currentString = '';
  let stringStart = 0;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    // Printable ASCII range (excluding DEL)
    if (byte >= 32 && byte < 127) {
      if (currentString.length === 0) {
        stringStart = i;
      }
      currentString += String.fromCharCode(byte);

      if (currentString.length >= maxLength) {
        if (currentString.length >= minLength) {
          results.push({ offset: stringStart, value: currentString });
        }
        currentString = '';
      }
    } else {
      if (currentString.length >= minLength) {
        results.push({ offset: stringStart, value: currentString });
      }
      currentString = '';
    }
  }

  // Handle string at end of buffer
  if (currentString.length >= minLength) {
    results.push({ offset: stringStart, value: currentString });
  }

  return results;
}

/**
 * Scan for potential record boundaries using heuristics
 *
 * Looks for patterns that suggest record starts:
 * - Reasonable length field (4-byte value < remaining buffer)
 * - Followed by recognizable type markers or strings
 */
export function scanForRecords(
  buffer: Buffer,
  options?: { maxRecords?: number; minLength?: number; startOffset?: number }
): MARecord[] {
  const maxRecords = options?.maxRecords ?? 1000;
  const minLength = options?.minLength ?? 8;
  const startOffset = options?.startOffset ?? 0;

  const records: MARecord[] = [];
  const reader = new BinaryReader(buffer, startOffset);

  while (reader.hasMore() && records.length < maxRecords) {
    const offset = reader.position;

    // Need at least 8 bytes for a minimal record
    if (reader.remaining() < 8) break;

    // Try to read a length field
    const length = reader.peekUInt32LE();

    // Sanity check: length should be reasonable
    if (length < minLength || length > reader.remaining()) {
      reader.skip(1);
      continue;
    }

    // Read the record
    reader.skip(4); // Skip length

    // Read type marker (1 byte)
    const typeMarker = reader.readUInt8();

    // Try to read name if it looks like a string follows
    let name: string | null = null;
    const nameOffset = reader.position;

    try {
      // Check if next bytes look like printable ASCII
      const nextByte = reader.peekUInt8();
      if (nextByte >= 32 && nextByte < 127) {
        name = reader.readNullTerminatedString(256);
      }
    } catch {
      // No valid string, that's ok
      reader.seek(nameOffset);
    }

    // Calculate data size
    const dataSize = length - (reader.position - offset);

    records.push({
      offset,
      length,
      typeMarker,
      dataSize: Math.max(0, dataSize),
      name,
      children: [],
      raw: buffer.subarray(offset, offset + length),
    });

    // Move to next potential record
    reader.seek(offset + length);
  }

  return records;
}

/**
 * Find records by name pattern
 */
export function findRecordsByName(
  records: MARecord[],
  pattern: RegExp | string
): MARecord[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

  return records.filter((r) => r.name && regex.test(r.name));
}

/**
 * Find all strings that look like show names
 * (Heuristic: strings containing "show", "backup", common show name patterns)
 */
export function findShowNames(buffer: Buffer): Array<{ offset: number; name: string }> {
  const strings = scanForStrings(buffer, 4, 128);

  // Filter for likely show names
  return strings
    .filter((s) => {
      const lower = s.value.toLowerCase();
      // Exclude obvious non-show strings
      if (
        lower.includes('http') ||
        lower.includes('file:') ||
        lower.includes('.dll') ||
        lower.includes('.exe') ||
        lower.includes('programdata') ||
        lower.includes('c:\\') ||
        lower.includes('d:\\')
      ) {
        return false;
      }
      // Include strings that look like show names
      return (
        lower.includes('show') ||
        lower.includes('backup') ||
        lower.includes('_v') ||
        lower.includes('2k') ||
        lower.includes('201') ||
        lower.includes('202') ||
        /^[a-z0-9_-]+$/i.test(s.value)
      );
    })
    .map((s) => ({ offset: s.offset, name: s.value }));
}

/**
 * Parse a single record from the buffer
 */
export function parseRecord(ctx: ParseContext): MARecord | null {
  const reader = new BinaryReader(ctx.buffer, ctx.offset);

  if (reader.remaining() < 8) {
    return null;
  }

  const offset = ctx.offset;
  const length = reader.readUInt32LE();

  if (length === 0 || length > reader.remaining() + 4) {
    ctx.errors.push({
      offset,
      message: `Invalid record length: ${length}`,
      path: [...ctx.path],
    });
    return null;
  }

  const typeMarker = reader.readUInt8();

  // Try to read additional fields based on type
  let dataSize = 0;
  let name: string | null = null;

  // Look for string name
  try {
    const nextByte = reader.peekUInt8();
    if (nextByte >= 32 && nextByte < 127) {
      name = reader.readNullTerminatedString(256);
    }
  } catch {
    // No string found
  }

  dataSize = length - (reader.position - offset);

  return {
    offset,
    length,
    typeMarker,
    dataSize,
    name,
    children: [],
    raw: ctx.buffer.subarray(offset, offset + length),
  };
}

/**
 * Get a summary of record types found in the buffer
 */
export function getRecordTypeSummary(
  records: MARecord[]
): Map<number, { count: number; names: string[] }> {
  const summary = new Map<number, { count: number; names: string[] }>();

  for (const record of records) {
    const existing = summary.get(record.typeMarker);
    if (existing) {
      existing.count++;
      if (record.name && !existing.names.includes(record.name)) {
        existing.names.push(record.name);
      }
    } else {
      summary.set(record.typeMarker, {
        count: 1,
        names: record.name ? [record.name] : [],
      });
    }
  }

  return summary;
}
