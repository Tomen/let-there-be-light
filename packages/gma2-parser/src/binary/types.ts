/**
 * MA DATA file header structure
 */
export interface MADataHeader {
  magic: string;
  version: MAVersion;
  headerSize: number;
  timestamp: number;
}

/**
 * MA version information
 */
export interface MAVersion {
  major: number;
  minor: number;
  patch: number;
  raw: Buffer;
}

/**
 * Generic MA record structure
 */
export interface MARecord {
  offset: number;
  length: number;
  typeMarker: number;
  dataSize: number;
  name: string | null;
  children: MARecord[];
  raw: Buffer;
}

/**
 * Record types (discovered through reverse engineering)
 */
export const RecordType = {
  UNKNOWN: 0x00,
  SHOW: 0x01,
  FIXTURE: 0x02,
  GROUP: 0x03,
  PRESET: 0x04,
  SEQUENCE: 0x05,
  CUE: 0x06,
} as const;

export type RecordTypeValue = (typeof RecordType)[keyof typeof RecordType];

/**
 * Parsing context for tracking position and errors
 */
export interface ParseContext {
  buffer: Buffer;
  offset: number;
  errors: ParseError[];
  path: string[];
}

/**
 * Parse error information
 */
export interface ParseError {
  offset: number;
  message: string;
  path: string[];
}

/**
 * Show file info (without full decompression)
 */
export interface ShowFileInfo {
  path: string;
  compressedSize: number;
  isCompressed: boolean;
}
