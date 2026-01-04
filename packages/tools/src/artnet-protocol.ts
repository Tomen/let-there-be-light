/**
 * Art-Net Protocol Implementation
 *
 * Art-Net is a protocol for transmitting DMX512 lighting control data over UDP/IP.
 * It was developed by Artistic Licence and is widely used in professional lighting.
 *
 * Key protocol details:
 * - UDP port 6454
 * - All packets start with "Art-Net\0" (8 bytes)
 * - OpCodes are 16-bit little-endian
 * - Protocol version is 14 (0x000e)
 */

// Art-Net packet identifier - all packets start with this
export const ARTNET_ID = Buffer.from('Art-Net\0');

// Art-Net OpCodes (16-bit, little-endian in packets)
export const OpCode = {
  // Discovery
  ArtPoll: 0x2000,      // Controller -> Nodes: "Who's there?"
  ArtPollReply: 0x2100, // Node -> Controller: "I'm here, here's my info"

  // DMX Data
  ArtDmx: 0x5000,       // DMX512 data packet (most common)

  // Other (less commonly used)
  ArtSync: 0x5200,      // Synchronization packet
  ArtAddress: 0x6000,   // Program node settings
  ArtInput: 0x7000,     // Status of input ports
} as const;

export type OpCodeType = typeof OpCode[keyof typeof OpCode];

// Art-Net protocol version
const PROTOCOL_VERSION = 14;

/**
 * Parsed Art-Net packet base structure
 */
export interface ArtNetPacket {
  opCode: number;
  opCodeName: string;
  raw: Buffer;
}

/**
 * ArtPollReply packet data
 * This is returned by devices in response to ArtPoll
 */
export interface ArtPollReplyData extends ArtNetPacket {
  opCode: typeof OpCode.ArtPollReply;
  ipAddress: string;
  port: number;
  versionHi: number;
  versionLo: number;
  netSwitch: number;
  subSwitch: number;
  oemHi: number;
  oemLo: number;
  ubeaVersion: number;
  status1: number;
  estaCode: number;
  shortName: string;
  longName: string;
  nodeReport: string;
  numPorts: number;
  portTypes: number[];
  inputStatus: number[];
  outputStatus: number[];
  inputUniverses: number[];
  outputUniverses: number[];
  macAddress: string;
  status2: number;
}

/**
 * ArtDmx packet data
 * Contains DMX512 channel data for a specific universe
 */
export interface ArtDmxData extends ArtNetPacket {
  opCode: typeof OpCode.ArtDmx;
  protocolVersion: number;
  sequence: number;
  physical: number;
  universe: number;    // 15-bit universe (SubUni + Net)
  subUni: number;      // 8-bit sub-universe
  net: number;         // 7-bit net
  length: number;      // Number of DMX channels (2-512)
  dmxData: Buffer;     // The actual DMX values
}

/**
 * Create an ArtPoll packet for device discovery
 *
 * ArtPoll Packet Structure (14 bytes):
 * ┌────────────┬────────┬──────────────────────────────────────┐
 * │ Offset     │ Length │ Description                          │
 * ├────────────┼────────┼──────────────────────────────────────┤
 * │ 0-7        │ 8      │ "Art-Net\0" identifier               │
 * │ 8-9        │ 2      │ OpCode (0x2000) little-endian        │
 * │ 10-11      │ 2      │ Protocol version (14) big-endian     │
 * │ 12         │ 1      │ TalkToMe flags                       │
 * │ 13         │ 1      │ Priority (0 = lowest)                │
 * └────────────┴────────┴──────────────────────────────────────┘
 */
export function createArtPoll(): Buffer {
  const packet = Buffer.alloc(14);
  let offset = 0;

  // Art-Net ID (8 bytes)
  ARTNET_ID.copy(packet, offset);
  offset += 8;

  // OpCode - ArtPoll (0x2000) - little-endian
  packet.writeUInt16LE(OpCode.ArtPoll, offset);
  offset += 2;

  // Protocol version (14) - big-endian per spec
  packet.writeUInt16BE(PROTOCOL_VERSION, offset);
  offset += 2;

  // TalkToMe flags:
  // Bit 0: 0 = Only send ArtPollReply when needed
  //        1 = Send ArtPollReply on any change
  // Bit 1: 0 = Send me diagnostics unicast
  //        1 = Send me diagnostics broadcast
  // Bit 2: 0 = Disable diagnostics
  //        1 = Enable diagnostics
  // We want: bit 1 set (broadcast replies), bit 2 set (diagnostics on)
  packet.writeUInt8(0b00000110, offset);
  offset += 1;

  // Priority (0 = critical, 255 = lowest)
  packet.writeUInt8(0, offset);

  return packet;
}

/**
 * Create an ArtDmx packet for sending DMX data
 *
 * ArtDmx Packet Structure (18 + length bytes):
 * ┌────────────┬────────┬──────────────────────────────────────┐
 * │ Offset     │ Length │ Description                          │
 * ├────────────┼────────┼──────────────────────────────────────┤
 * │ 0-7        │ 8      │ "Art-Net\0" identifier               │
 * │ 8-9        │ 2      │ OpCode (0x5000) little-endian        │
 * │ 10-11      │ 2      │ Protocol version (14) big-endian     │
 * │ 12         │ 1      │ Sequence (0-255, 0 disables)         │
 * │ 13         │ 1      │ Physical port (informational)        │
 * │ 14         │ 1      │ SubUni (universe low byte)           │
 * │ 15         │ 1      │ Net (universe high 7 bits)           │
 * │ 16-17      │ 2      │ Length (2-512) big-endian            │
 * │ 18+        │ length │ DMX channel data                     │
 * └────────────┴────────┴──────────────────────────────────────┘
 *
 * Universe addressing:
 * - Art-Net uses 15-bit addressing: (Net << 8) | SubUni
 * - This allows for 32,768 universes
 * - Most systems only use SubUni (0-255)
 *
 * @param universe - Universe number (0-32767)
 * @param dmxData - Buffer of DMX values (1-512 bytes)
 * @param sequence - Sequence number for packet ordering (0 = disabled)
 */
export function createArtDmx(
  universe: number,
  dmxData: Buffer,
  sequence: number = 0
): Buffer {
  // Ensure DMX data is at least 2 bytes and max 512
  const length = Math.min(Math.max(dmxData.length, 2), 512);

  // Pad to even number (Art-Net requirement)
  const paddedLength = length + (length % 2);

  const packet = Buffer.alloc(18 + paddedLength);
  let offset = 0;

  // Art-Net ID (8 bytes)
  ARTNET_ID.copy(packet, offset);
  offset += 8;

  // OpCode - ArtDmx (0x5000) - little-endian
  packet.writeUInt16LE(OpCode.ArtDmx, offset);
  offset += 2;

  // Protocol version (14) - big-endian
  packet.writeUInt16BE(PROTOCOL_VERSION, offset);
  offset += 2;

  // Sequence (0 = disabled, 1-255 = ordering)
  packet.writeUInt8(sequence & 0xff, offset);
  offset += 1;

  // Physical input port (0 = not used, informational only)
  packet.writeUInt8(0, offset);
  offset += 1;

  // SubUni (low 8 bits of universe)
  const subUni = universe & 0xff;
  packet.writeUInt8(subUni, offset);
  offset += 1;

  // Net (high 7 bits of universe)
  const net = (universe >> 8) & 0x7f;
  packet.writeUInt8(net, offset);
  offset += 1;

  // Length - big-endian (only field that's big-endian in ArtDmx!)
  packet.writeUInt16BE(paddedLength, offset);
  offset += 2;

  // DMX data
  dmxData.copy(packet, offset, 0, length);

  return packet;
}

/**
 * Get the human-readable name for an OpCode
 */
function getOpCodeName(opCode: number): string {
  for (const [name, code] of Object.entries(OpCode)) {
    if (code === opCode) return name;
  }
  return `Unknown(0x${opCode.toString(16).padStart(4, '0')})`;
}

/**
 * Parse an incoming Art-Net packet
 * Returns the packet type and basic info, or null if not valid Art-Net
 */
export function parsePacket(data: Buffer): ArtNetPacket | null {
  // Minimum packet size check
  if (data.length < 12) return null;

  // Check Art-Net ID
  if (!data.subarray(0, 8).equals(ARTNET_ID)) return null;

  // Read OpCode (little-endian)
  const opCode = data.readUInt16LE(8);

  return {
    opCode,
    opCodeName: getOpCodeName(opCode),
    raw: data,
  };
}

/**
 * Parse an ArtPollReply packet
 *
 * ArtPollReply Packet Structure (239 bytes):
 * ┌────────────┬────────┬──────────────────────────────────────┐
 * │ Offset     │ Length │ Description                          │
 * ├────────────┼────────┼──────────────────────────────────────┤
 * │ 0-7        │ 8      │ "Art-Net\0" identifier               │
 * │ 8-9        │ 2      │ OpCode (0x2100) little-endian        │
 * │ 10-13      │ 4      │ IP address (big-endian)              │
 * │ 14-15      │ 2      │ Port (little-endian, always 0x1936)  │
 * │ 16-17      │ 2      │ Firmware version                     │
 * │ 18         │ 1      │ NetSwitch                            │
 * │ 19         │ 1      │ SubSwitch                            │
 * │ 20-21      │ 2      │ OEM code                             │
 * │ 22         │ 1      │ UBEA version                         │
 * │ 23         │ 1      │ Status1                              │
 * │ 24-25      │ 2      │ ESTA manufacturer code               │
 * │ 26-43      │ 18     │ Short name (null-terminated)         │
 * │ 44-107     │ 64     │ Long name (null-terminated)          │
 * │ 108-171    │ 64     │ Node report (null-terminated)        │
 * │ 172-173    │ 2      │ NumPorts (high byte, low byte)       │
 * │ 174-177    │ 4      │ Port types                           │
 * │ 178-181    │ 4      │ GoodInput                            │
 * │ 182-185    │ 4      │ GoodOutput                           │
 * │ 186-189    │ 4      │ SwIn (input universe)                │
 * │ 190-193    │ 4      │ SwOut (output universe)              │
 * │ ...        │ ...    │ (more fields)                        │
 * │ 201-206    │ 6      │ MAC address                          │
 * │ ...        │ ...    │ (more fields to 239)                 │
 * └────────────┴────────┴──────────────────────────────────────┘
 */
export function parseArtPollReply(data: Buffer): ArtPollReplyData | null {
  if (data.length < 207) return null;

  // Verify it's an ArtPollReply
  const opCode = data.readUInt16LE(8);
  if (opCode !== OpCode.ArtPollReply) return null;

  // Parse IP address (bytes 10-13, big-endian)
  const ipAddress = `${data[10]}.${data[11]}.${data[12]}.${data[13]}`;

  // Port (little-endian)
  const port = data.readUInt16LE(14);

  // Firmware version
  const versionHi = data[16];
  const versionLo = data[17];

  // Net and Sub
  const netSwitch = data[18];
  const subSwitch = data[19];

  // OEM
  const oemHi = data[20];
  const oemLo = data[21];

  // UBEA version
  const ubeaVersion = data[22];

  // Status1
  const status1 = data[23];

  // ESTA code
  const estaCode = data.readUInt16LE(24);

  // Short name (18 bytes, null-terminated)
  const shortName = data.subarray(26, 44).toString('ascii').replace(/\0+$/, '');

  // Long name (64 bytes, null-terminated)
  const longName = data.subarray(44, 108).toString('ascii').replace(/\0+$/, '');

  // Node report (64 bytes, null-terminated)
  const nodeReport = data.subarray(108, 172).toString('ascii').replace(/\0+$/, '');

  // Number of ports
  const numPorts = data.readUInt16BE(172);

  // Port types (4 bytes)
  const portTypes = [data[174], data[175], data[176], data[177]];

  // GoodInput status
  const inputStatus = [data[178], data[179], data[180], data[181]];

  // GoodOutput status
  const outputStatus = [data[182], data[183], data[184], data[185]];

  // Input universes (SwIn)
  const inputUniverses = [data[186], data[187], data[188], data[189]];

  // Output universes (SwOut)
  const outputUniverses = [data[190], data[191], data[192], data[193]];

  // MAC address (bytes 201-206)
  const macBytes = data.subarray(201, 207);
  const macAddress = Array.from(macBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');

  // Status2 (byte 212 in full packet)
  const status2 = data.length > 212 ? data[212] : 0;

  return {
    opCode: OpCode.ArtPollReply,
    opCodeName: 'ArtPollReply',
    raw: data,
    ipAddress,
    port,
    versionHi,
    versionLo,
    netSwitch,
    subSwitch,
    oemHi,
    oemLo,
    ubeaVersion,
    status1,
    estaCode,
    shortName,
    longName,
    nodeReport,
    numPorts,
    portTypes,
    inputStatus,
    outputStatus,
    inputUniverses,
    outputUniverses,
    macAddress,
    status2,
  };
}

/**
 * Parse an ArtDmx packet
 */
export function parseArtDmx(data: Buffer): ArtDmxData | null {
  if (data.length < 18) return null;

  // Verify it's an ArtDmx
  const opCode = data.readUInt16LE(8);
  if (opCode !== OpCode.ArtDmx) return null;

  // Protocol version
  const protocolVersion = data.readUInt16BE(10);

  // Sequence
  const sequence = data[12];

  // Physical port
  const physical = data[13];

  // SubUni and Net
  const subUni = data[14];
  const net = data[15];

  // Combined universe
  const universe = (net << 8) | subUni;

  // Length (big-endian)
  const length = data.readUInt16BE(16);

  // DMX data
  const dmxData = data.subarray(18, 18 + length);

  return {
    opCode: OpCode.ArtDmx,
    opCodeName: 'ArtDmx',
    raw: data,
    protocolVersion,
    sequence,
    physical,
    universe,
    subUni,
    net,
    length,
    dmxData,
  };
}

/**
 * Create a 512-channel DMX buffer initialized to zeros (blackout)
 */
export function createDmxBuffer(): Buffer {
  return Buffer.alloc(512);
}

/**
 * Utility: Format universe number for display
 * Shows both the simple number and the Net:SubUni format
 */
export function formatUniverse(universe: number): string {
  const net = (universe >> 8) & 0x7f;
  const subUni = universe & 0xff;
  if (net === 0) {
    return `${universe}`;
  }
  return `${universe} (Net ${net}, SubUni ${subUni})`;
}
