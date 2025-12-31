# Art-Net Diagnostics Toolkit — Build Prompt

## Context

I need to control church lighting via Art-Net. The current setup:

- **GrandMA2 console** outputs Art-Net (no direct DMX)
- **Dedicated isolated network** labeled "Art-Net"
- **Static IPs**, subnet 255.0.0.0
  - GrandMA2 primary: 2.0.0.1
  - GrandMA2 secondary: 2.0.0.2
- **My laptop** will connect to this network with IP 2.0.0.10

Art-Net uses UDP port 6454.

## Goal

Build a Node.js diagnostics toolkit with 5 tools that progressively test connectivity and control, so I can verify on-site that my laptop can control the lights.

## Tools to Build

### Tool 1: Connectivity Test
- Ping GrandMA2 at 2.0.0.1
- Verify basic network reachability
- Print clear pass/fail output

### Tool 2: Art-Net Sniffer
- Listen on UDP port 6454
- Display any Art-Net packets seen on the network
- Parse and show: packet type, universe, source IP
- Useful to see if GrandMA2 is actively outputting

### Tool 3: Art-Net Discovery
- Broadcast an ArtPoll packet (opcode 0x2000)
- Listen for ArtPollReply responses
- Display discovered devices with their IP, name, and capabilities
- Timeout after 5 seconds

### Tool 4: Single Channel Test
- Send Art-Net DMX data (ArtDmx, opcode 0x5000) to a specific universe/channel
- CLI arguments: `--universe 0 --channel 1 --value 255`
- Send continuously (Art-Net expects periodic refresh) until Ctrl+C
- Print what's being sent

### Tool 5: Interactive Control
- Simple CLI interface
- Commands like:
  - `set <universe> <channel> <value>` — set a single channel
  - `all <universe> <value>` — set all 512 channels to same value
  - `blackout` — all channels to 0
  - `chase <universe>` — cycle through channels one at a time (helps identify fixtures)
  - `quit` — exit
- Continuously output Art-Net while running

## Technical Requirements

- Use Node.js with ES modules
- Use native `dgram` for UDP (no external Art-Net libraries — I want to understand the protocol)
- Put shared config (IPs, port) in a separate config.js
- Each tool should be runnable standalone via npm scripts
- Include comments explaining the Art-Net packet structure

## Project Structure

```
artnet-diag/
├── package.json
├── src/
│   ├── config.js
│   ├── artnet-protocol.js    # Shared packet building/parsing
│   ├── 1-connectivity-test.js
│   ├── 2-artnet-sniffer.js
│   ├── 3-artnet-discovery.js
│   ├── 4-single-channel.js
│   └── 5-interactive-control.js
└── README.md
```

## Art-Net Protocol Notes

- All packets start with "Art-Net\0" (8 bytes)
- Little-endian for most fields
- ArtPoll (0x2000): Discovery broadcast
- ArtPollReply (0x2100): Device response
- ArtDmx (0x5000): DMX data packet, contains 512 channel values
- Broadcast address for 2.0.0.0/8 network: 2.255.255.255

## Success Criteria

After running through tools 1-5 in order, I should be able to:
1. Confirm my laptop is on the network
2. See what Art-Net traffic exists
3. Discover the GrandMA2 and any nodes
4. Turn a light on/off by setting a channel value
5. Interactively explore which channels control which fixtures