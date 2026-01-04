# @let-there-be-light/tools

Art-Net protocol implementation and diagnostic tools.

## Quick Start

```bash
# Test network connectivity
pnpm --filter @let-there-be-light/tools ping

# Listen for Art-Net traffic
pnpm --filter @let-there-be-light/tools sniff

# Interactive fixture control
pnpm --filter @let-there-be-light/tools fixture
```

## Diagnostic Tools

| Command | Description |
|---------|-------------|
| `ping` | Test network connectivity to GrandMA2 |
| `sniff` | Listen for Art-Net traffic on UDP 6454 |
| `discover` | Broadcast ArtPoll and find devices |
| `channel` | Control a single DMX channel |
| `control` | Interactive DMX control CLI |
| `fixture` | Fixture and group control CLI |
| `flash` | Flash a group on/off at interval |
| `chase` | Chase wave effect |
| `generate` | Generate fixtures and groups |

## Core Modules

### artnet-protocol.ts

Low-level packet building and parsing.

```typescript
// Create DMX packet
const packet = createArtDmx(universe, dmxBuffer, sequence);

// Parse incoming packet
const data = parsePacket(buffer);
```

### artnet-controller.ts

DMX state management and output.

```typescript
const controller = getController();

// Set channels
controller.setChannel(universe, channel, value);
controller.setAll(universe, value);
controller.blackout();

// Fixture control
controller.setFixtureColor('front-left', 'red');
controller.setGroupColor('all-wash', { r: 1, g: 0.5, b: 0 });

// Start/stop output
controller.startOutput();
controller.stopOutput();
```

### fixtures.ts

Fixture definitions and color mapping.

```typescript
const store = getFixtureStore();

const fixture = store.getFixture('front-left');
const group = store.getGroup('all-wash');
const model = store.getModel('generic-rgbw');

// Color to DMX channels
const channels = mapColorToChannels(fixture, { r: 1, g: 0, b: 0 });
```

## Configuration

Edit `config.yaml`:

```yaml
network:
  myIp: "2.0.0.10"
  grandma2Primary: "2.0.0.1"
  grandma2Secondary: "2.0.0.2"
  broadcast: "2.255.255.255"
  subnet: "255.0.0.0"

artnet:
  port: 6454
  refreshRateHz: 25
```

## Fixture Definitions

Edit `fixtures.yaml`:

```yaml
models:
  generic-rgbw:
    brand: "Generic"
    model: "RGBW Par"
    channels:
      red: 1
      green: 2
      blue: 3
      white: 4

fixtures:
  - name: "front-left"
    model: generic-rgbw
    universe: 0
    startChannel: 1

groups:
  front:
    - front-left
    - front-right
```

## MCP Server

The MCP server is in a separate package: `@let-there-be-light/mcp`

Add to Claude Code:

```bash
claude mcp add artnet -- pnpm --filter @let-there-be-light/mcp mcp
```

### Tools

| Tool | Description |
|------|-------------|
| setChannel | Set a single DMX channel |
| setAll | Set all 512 channels |
| blackout | Set all channels to 0 |
| startOutput | Begin Art-Net transmission |
| stopOutput | Stop transmission |
| getStatus | Get current DMX state |
| listFixtures | List fixtures and groups |
| setFixtureColor | Set fixture color |
| setGroupColor | Set group color |
| turnOffFixture | Turn off fixture |
| turnOffGroup | Turn off group |

---

## Art-Net Protocol Reference

### Packet Types

| OpCode | Name | Description |
|--------|------|-------------|
| 0x2000 | ArtPoll | Discovery broadcast |
| 0x2100 | ArtPollReply | Device response to ArtPoll |
| 0x5000 | ArtDmx | DMX512 data (512 channels) |
| 0x5200 | ArtSync | Synchronization trigger |

### Packet Structure

All Art-Net packets start with:
```
Bytes 0-7:  "Art-Net\0" (identifier)
Bytes 8-9:  OpCode (16-bit, little-endian)
```

### ArtDmx (DMX Data)

```
Offset  Length  Description
0-7     8       "Art-Net\0"
8-9     2       OpCode (0x5000)
10-11   2       Protocol version (14)
12      1       Sequence (0-255, 0 = disabled)
13      1       Physical port (informational)
14      1       SubUni (universe low byte)
15      1       Net (universe high 7 bits)
16-17   2       Length (2-512, big-endian!)
18+     n       DMX channel data
```

### Universe Addressing

Art-Net uses 15-bit universe addressing:
- **Simple:** Universe 0-255 (most common)
- **Extended:** Net (0-127) + SubUni (0-255) = 32,768 universes

Universe number = (Net << 8) | SubUni

---

## Detailed Tool Usage

### Connectivity Test (`ping`)

```bash
pnpm --filter @let-there-be-light/tools ping
```

Pings the GrandMA2 to verify basic network connectivity. This should be your first test.

**Expected output:**
- PASS: Host is reachable with latency
- FAIL: Troubleshooting tips displayed

### Art-Net Sniffer (`sniff`)

```bash
pnpm --filter @let-there-be-light/tools sniff
```

Listens on UDP port 6454 and displays all Art-Net packets on the network.

**What you'll see:**
- ArtDmx packets (DMX data)
- ArtPoll packets (discovery requests)
- ArtPollReply packets (device announcements)
- Packet statistics on exit

Press `Ctrl+C` to stop.

### Art-Net Discovery (`discover`)

```bash
pnpm --filter @let-there-be-light/tools discover
```

Broadcasts an ArtPoll packet and listens for device responses. Shows all Art-Net devices on the network with their IP, MAC address, device name, firmware version, and capabilities.

Times out after 5 seconds.

### Single Channel Control (`channel`)

```bash
pnpm --filter @let-there-be-light/tools channel -- --universe 0 --channel 1 --value 255
```

Sends continuous Art-Net DMX data to a specific channel.

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| --universe | -u | 0 | Universe number (0-32767) |
| --channel | -c | 1 | DMX channel (1-512) |
| --value | -v | 255 | DMX value (0-255) |
| --target | -t | broadcast | Target IP address |

**Examples:**
```bash
pnpm ... channel                        # Channel 1 @ 255 on universe 0
pnpm ... channel -- -c 5 -v 128         # Channel 5 @ 50% on universe 0
pnpm ... channel -- -u 1 -c 10 -v 200   # Channel 10 @ 78% on universe 1
```

Press `Ctrl+C` to stop (sends blackout before exiting).

### Interactive Control (`control`)

```bash
pnpm --filter @let-there-be-light/tools control
```

Full interactive CLI for controlling Art-Net.

| Command | Description |
|---------|-------------|
| `set <universe> <channel> <value>` | Set a single channel (1-512) to value (0-255) |
| `all <universe> <value>` | Set all 512 channels to same value |
| `blackout` | Set all channels in all universes to 0 |
| `chase <universe>` | Cycle through channels one at a time |
| `status` | Show current DMX state |
| `help` | Show commands |
| `quit` | Exit (sends blackout first) |

---

## Troubleshooting

### Ping fails
1. Check you're connected to the Art-Net network
2. Verify your IP is set correctly (2.0.0.10)
3. Check subnet mask (255.0.0.0)
4. Ensure GrandMA2 is powered on
5. Check no firewall is blocking ICMP

### No Art-Net traffic visible
1. Run the sniffer: `pnpm --filter @let-there-be-light/tools sniff`
2. On GrandMA2, ensure Art-Net output is enabled
3. Check the GrandMA2 is sending to the right IP range
4. Verify network switch/cables are working

### Discovery finds no devices
1. Check broadcast address matches your network
2. Some devices don't respond to ArtPoll (try sniffing instead)
3. Firewall may be blocking UDP 6454

### Channel control not working
1. Verify the universe number matches GrandMA2 config
2. Check the GrandMA2 is in a mode that accepts Art-Net input
3. Use chase mode to find which channels control fixtures
4. Check DMX addressing on the fixtures themselves
