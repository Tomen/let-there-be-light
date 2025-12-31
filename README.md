# Let There Be Light - Art-Net Diagnostics Toolkit

A TypeScript toolkit for diagnosing and controlling Art-Net lighting systems. Designed for use with GrandMA2 consoles on isolated Art-Net networks.

## Quick Start

```bash
# Install dependencies
npm install

# Configure your network settings
# Edit config.yaml with your IP addresses

# Run tools in order:
npm run ping      # 1. Test network connectivity
npm run sniff     # 2. See Art-Net traffic on network
npm run discover  # 3. Find Art-Net devices
npm run channel   # 4. Control a single channel
npm run control   # 5. Interactive control
```

## Network Setup

This toolkit is designed for the following network configuration:

| Device | IP Address |
|--------|------------|
| GrandMA2 Primary | 2.0.0.1 |
| GrandMA2 Secondary | 2.0.0.2 |
| Your Laptop | 2.0.0.10 |
| Broadcast | 2.255.255.255 |

**Subnet Mask:** 255.0.0.0

Edit `config.yaml` to match your network if different.

## Tools

### Tool 1: Connectivity Test

```bash
npm run ping
```

Pings the GrandMA2 to verify basic network connectivity. This should be your first test.

**Expected output:**
- PASS: Host is reachable with latency
- FAIL: Troubleshooting tips displayed

### Tool 2: Art-Net Sniffer

```bash
npm run sniff
```

Listens on UDP port 6454 and displays all Art-Net packets on the network. Use this to verify the GrandMA2 is outputting Art-Net data.

**What you'll see:**
- ArtDmx packets (DMX data)
- ArtPoll packets (discovery requests)
- ArtPollReply packets (device announcements)
- Packet statistics on exit

Press `Ctrl+C` to stop.

### Tool 3: Art-Net Discovery

```bash
npm run discover
```

Broadcasts an ArtPoll packet and listens for device responses. Shows all Art-Net devices on the network with their:

- IP and MAC address
- Device name
- Firmware version
- Configured universes and ports
- Capabilities

Times out after 5 seconds.

### Tool 4: Single Channel Control

```bash
npm run channel -- --universe 0 --channel 1 --value 255
```

Sends continuous Art-Net DMX data to a specific channel. Useful for quickly testing if a fixture responds.

**Options:**
| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| --universe | -u | 0 | Universe number (0-32767) |
| --channel | -c | 1 | DMX channel (1-512) |
| --value | -v | 255 | DMX value (0-255) |
| --target | -t | broadcast | Target IP address |

**Examples:**
```bash
npm run channel                        # Channel 1 @ 255 on universe 0
npm run channel -- -c 5 -v 128         # Channel 5 @ 50% on universe 0
npm run channel -- -u 1 -c 10 -v 200   # Channel 10 @ 78% on universe 1
```

Press `Ctrl+C` to stop (sends blackout before exiting).

### Tool 5: Interactive Control

```bash
npm run control
```

Full interactive CLI for controlling Art-Net. Maintains DMX state and continuously outputs at the configured refresh rate.

**Commands:**

| Command | Description |
|---------|-------------|
| `set <universe> <channel> <value>` | Set a single channel (1-512) to value (0-255) |
| `all <universe> <value>` | Set all 512 channels to same value |
| `blackout` | Set all channels in all universes to 0 |
| `chase <universe>` | Cycle through channels one at a time |
| `status` | Show current DMX state |
| `help` | Show commands |
| `quit` | Exit (sends blackout first) |

**Examples:**
```
> set 0 1 255      # Universe 0, channel 1 at 100%
> set 0 5 128      # Universe 0, channel 5 at 50%
> all 0 255        # All channels at 100%
> chase 0          # Chase effect to find fixtures
> blackout         # Everything off
> quit             # Exit
```

## Configuration

Edit `config.yaml` to customize settings:

```yaml
network:
  myIp: "2.0.0.10"           # Your laptop's IP
  grandma2Primary: "2.0.0.1"  # GrandMA2 primary console
  grandma2Secondary: "2.0.0.2" # GrandMA2 secondary (NPU)
  broadcast: "2.255.255.255"  # Broadcast address for 2.x.x.x network
  subnet: "255.0.0.0"

artnet:
  port: 6454                  # Art-Net UDP port (standard)
  refreshRateHz: 25           # DMX output rate (25 Hz = 40ms)
```

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

## Troubleshooting

### Ping fails
1. Check you're connected to the Art-Net network
2. Verify your IP is set correctly (2.0.0.10)
3. Check subnet mask (255.0.0.0)
4. Ensure GrandMA2 is powered on
5. Check no firewall is blocking ICMP

### No Art-Net traffic visible
1. Run the sniffer: `npm run sniff`
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

## Development

```bash
# Type check
npx tsc --noEmit

# Build to JavaScript
npx tsc

# Run directly with tsx
npx tsx src/1-connectivity-test.ts
```

## License

MIT
