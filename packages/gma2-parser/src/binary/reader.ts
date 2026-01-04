/**
 * BinaryReader - Low-level buffer reading with position tracking
 *
 * Follows little-endian convention observed in MA DATA format
 */
export class BinaryReader {
  private buffer: Buffer;
  private _offset: number;

  constructor(buffer: Buffer, startOffset: number = 0) {
    this.buffer = buffer;
    this._offset = startOffset;
  }

  /**
   * Current position in the buffer
   */
  get position(): number {
    return this._offset;
  }

  /**
   * Total buffer length
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Seek to an absolute position
   */
  seek(offset: number): void {
    if (offset < 0 || offset > this.buffer.length) {
      throw new RangeError(
        `Seek offset ${offset} out of bounds (0-${this.buffer.length})`
      );
    }
    this._offset = offset;
  }

  /**
   * Skip a number of bytes
   */
  skip(bytes: number): void {
    this.seek(this._offset + bytes);
  }

  /**
   * Get remaining bytes in buffer
   */
  remaining(): number {
    return this.buffer.length - this._offset;
  }

  /**
   * Check if there are more bytes to read
   */
  hasMore(): boolean {
    return this._offset < this.buffer.length;
  }

  /**
   * Read unsigned 8-bit integer
   */
  readUInt8(): number {
    this.ensureBytes(1);
    const value = this.buffer.readUInt8(this._offset);
    this._offset += 1;
    return value;
  }

  /**
   * Read signed 8-bit integer
   */
  readInt8(): number {
    this.ensureBytes(1);
    const value = this.buffer.readInt8(this._offset);
    this._offset += 1;
    return value;
  }

  /**
   * Read unsigned 16-bit integer (little-endian)
   */
  readUInt16LE(): number {
    this.ensureBytes(2);
    const value = this.buffer.readUInt16LE(this._offset);
    this._offset += 2;
    return value;
  }

  /**
   * Read unsigned 16-bit integer (big-endian)
   */
  readUInt16BE(): number {
    this.ensureBytes(2);
    const value = this.buffer.readUInt16BE(this._offset);
    this._offset += 2;
    return value;
  }

  /**
   * Read signed 16-bit integer (little-endian)
   */
  readInt16LE(): number {
    this.ensureBytes(2);
    const value = this.buffer.readInt16LE(this._offset);
    this._offset += 2;
    return value;
  }

  /**
   * Read unsigned 32-bit integer (little-endian)
   */
  readUInt32LE(): number {
    this.ensureBytes(4);
    const value = this.buffer.readUInt32LE(this._offset);
    this._offset += 4;
    return value;
  }

  /**
   * Read unsigned 32-bit integer (big-endian)
   */
  readUInt32BE(): number {
    this.ensureBytes(4);
    const value = this.buffer.readUInt32BE(this._offset);
    this._offset += 4;
    return value;
  }

  /**
   * Read signed 32-bit integer (little-endian)
   */
  readInt32LE(): number {
    this.ensureBytes(4);
    const value = this.buffer.readInt32LE(this._offset);
    this._offset += 4;
    return value;
  }

  /**
   * Read 32-bit float (little-endian)
   */
  readFloatLE(): number {
    this.ensureBytes(4);
    const value = this.buffer.readFloatLE(this._offset);
    this._offset += 4;
    return value;
  }

  /**
   * Read 64-bit double (little-endian)
   */
  readDoubleLE(): number {
    this.ensureBytes(8);
    const value = this.buffer.readDoubleLE(this._offset);
    this._offset += 8;
    return value;
  }

  /**
   * Read a null-terminated string
   */
  readNullTerminatedString(maxLength: number = 1024): string {
    const startOffset = this._offset;
    let endOffset = this._offset;

    // Find null terminator
    while (
      endOffset < this.buffer.length &&
      endOffset - startOffset < maxLength
    ) {
      if (this.buffer[endOffset] === 0) {
        break;
      }
      endOffset++;
    }

    if (endOffset >= this.buffer.length) {
      throw new Error(
        `Null terminator not found within ${maxLength} bytes at offset 0x${startOffset.toString(16)}`
      );
    }

    const str = this.buffer.toString('utf8', startOffset, endOffset);
    this._offset = endOffset + 1; // Skip past null terminator
    return str;
  }

  /**
   * Read a fixed-length string (may include null bytes)
   */
  readFixedString(length: number): string {
    this.ensureBytes(length);
    const str = this.buffer.toString('utf8', this._offset, this._offset + length);
    this._offset += length;
    return str;
  }

  /**
   * Read a length-prefixed string (32-bit length prefix)
   */
  readLengthPrefixedString(): string {
    const length = this.readUInt32LE();
    if (length === 0) return '';
    return this.readFixedString(length);
  }

  /**
   * Read raw bytes into a new buffer
   */
  readBytes(length: number): Buffer {
    this.ensureBytes(length);
    const slice = Buffer.from(this.buffer.subarray(this._offset, this._offset + length));
    this._offset += length;
    return slice;
  }

  /**
   * Peek at bytes without advancing position
   */
  peekBytes(length: number): Buffer {
    this.ensureBytes(length);
    return Buffer.from(this.buffer.subarray(this._offset, this._offset + length));
  }

  /**
   * Peek at a single byte without advancing position
   */
  peekUInt8(): number {
    this.ensureBytes(1);
    return this.buffer.readUInt8(this._offset);
  }

  /**
   * Peek at a 32-bit unsigned integer without advancing position
   */
  peekUInt32LE(): number {
    this.ensureBytes(4);
    return this.buffer.readUInt32LE(this._offset);
  }

  /**
   * Get hex string of next N bytes (for debugging)
   */
  toHex(length: number): string {
    const bytes = this.peekBytes(Math.min(length, this.remaining()));
    return bytes.toString('hex').match(/.{2}/g)?.join(' ') ?? '';
  }

  /**
   * Get ASCII representation of next N bytes (for debugging)
   */
  toAscii(length: number): string {
    const bytes = this.peekBytes(Math.min(length, this.remaining()));
    return Array.from(bytes)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
      .join('');
  }

  /**
   * Create a sub-reader for a section of the buffer
   */
  subReader(length: number): BinaryReader {
    const slice = this.readBytes(length);
    return new BinaryReader(slice);
  }

  /**
   * Get underlying buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Ensure we have enough bytes to read
   */
  private ensureBytes(count: number): void {
    if (this._offset + count > this.buffer.length) {
      throw new RangeError(
        `Cannot read ${count} bytes at offset 0x${this._offset.toString(16)}: only ${this.remaining()} bytes remaining`
      );
    }
  }
}
