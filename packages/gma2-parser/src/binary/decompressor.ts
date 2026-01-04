import { gunzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import type { ShowFileInfo } from './types.js';

/**
 * Check if buffer is gzip compressed
 */
function isGzipCompressed(buffer: Buffer): boolean {
  // Gzip magic bytes: 0x1f 0x8b
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/**
 * Load and decompress a GMA2 show file
 *
 * Handles both .show.gz (compressed) and .show (uncompressed) files
 */
export function loadShowFile(filePath: string): Buffer {
  const compressed = readFileSync(filePath);

  if (isGzipCompressed(compressed)) {
    return gunzipSync(compressed);
  }

  return compressed;
}

/**
 * Get file info without full decompression
 */
export function getShowFileInfo(filePath: string): ShowFileInfo {
  const stats = statSync(filePath);
  const header = readFileSync(filePath, { length: 2 } as never);

  return {
    path: filePath,
    compressedSize: stats.size,
    isCompressed: isGzipCompressed(header as unknown as Buffer),
  };
}

/**
 * Decompress a buffer if it's gzip compressed
 */
export function decompressBuffer(buffer: Buffer): Buffer {
  if (isGzipCompressed(buffer)) {
    return gunzipSync(buffer);
  }
  return buffer;
}
