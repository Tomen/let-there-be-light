# Claude.md - Art-Net Diagnostics Toolkit

## Project Overview

This is an Art-Net diagnostics toolkit for controlling church lighting via a GrandMA2 console. It provides 7 progressive diagnostic tools to verify network connectivity and control DMX lighting fixtures.

## Network Configuration

- **Network:** Isolated Art-Net network with subnet 255.0.0.0
- **GrandMA2 Primary:** 2.0.0.1
- **GrandMA2 Secondary:** 2.0.0.2
- **Laptop IP:** 2.0.0.10
- **Broadcast:** 2.255.255.255
- **Art-Net Port:** UDP 6454

Edit `config.yaml` to modify network settings.

## Diagnostic Tools (Run in Order)

| Command | Description |
|---------|-------------|
| `npm run ping` | Test network connectivity to GrandMA2 |
| `npm run sniff` | Listen for Art-Net traffic (Ctrl+C to stop) |
| `npm run discover` | Broadcast ArtPoll and find devices |
| `npm run channel` | Control single DMX channel |
| `npm run control` | Interactive DMX control CLI |
| `npm run fixture` | Fixture and group control CLI |
| `npm run flash` | Flash a group on/off at interval |

## Key Files

**Core:**
- `src/artnet-protocol.ts` - Art-Net packet building/parsing
- `src/config.ts` - Configuration loader
- `src/artnet-controller.ts` - ArtNetController class (shared state manager)
- `src/fixtures.ts` - Fixture and group definitions loader
- `src/generate-fixtures.ts` - Fixture/group generator CLI
- `src/mcp-server.ts` - MCP server entry point

**Diagnostics (src/diagnostics/):**
- `1-connectivity-test.ts` - Ping test
- `2-artnet-sniffer.ts` - Packet sniffer
- `3-artnet-discovery.ts` - Device discovery
- `4-single-channel.ts` - Single channel control
- `5-interactive-control.ts` - Interactive CLI
- `6-fixture-control.ts` - Fixture/group control CLI
- `7-flash.ts` - Flash group on/off

## MCP Server

Add to Claude Code:
```bash
claude mcp add artnet -- npx tsx src/mcp-server.ts
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `setChannel` | Set a single DMX channel (universe, channel, value) |
| `setAll` | Set all 512 channels to same value |
| `blackout` | Set all channels to 0 |
| `startOutput` | Begin continuous Art-Net transmission |
| `stopOutput` | Stop transmission (sends blackout first) |
| `getStatus` | Get current DMX state and output status |
| `listFixtures` | List all fixtures and groups from fixtures.yaml |
| `setFixtureColor` | Set a fixture to a color (fixture, color) |
| `setGroupColor` | Set all fixtures in a group to a color |
| `turnOffFixture` | Turn off a fixture (all channels to 0) |
| `turnOffGroup` | Turn off all fixtures in a group |

## Art-Net Protocol

- All packets start with "Art-Net\0" (8 bytes)
- OpCodes: ArtPoll (0x2000), ArtPollReply (0x2100), ArtDmx (0x5000)
- Uses native Node.js `dgram` for UDP - no external Art-Net libraries

## Common Tasks

### Test a specific channel
```bash
npm run channel -- --universe 0 --channel 1 --value 255
```

### Find which channels control fixtures
```bash
npm run control
> chase 0
```

## Fixture Definitions

Edit `fixtures.yaml` to define your lighting fixtures and groups.

### Structure

```yaml
# Fixture models - reusable channel layouts
models:
  generic-rgbw:
    brand: "Generic"
    model: "RGBW Par"
    channels:
      red: 1
      green: 2
      blue: 3
      white: 4

# Fixtures in your venue
fixtures:
  - name: "front-left"
    model: generic-rgbw
    universe: 0
    startChannel: 1

# Named groups for easy control
groups:
  front:
    - front-left
    - front-right
```

### Available Colors

`red`, `green`, `blue`, `white`, `warm`, `cool`, `yellow`, `cyan`, `magenta`, `purple`, `orange`, `pink`, `amber`, `off`

### Fixture Control Commands

```bash
# One-shot commands (no interactive mode)
npm run fixture color pinspots-luster white
npm run fixture off rgb-luster
npm run fixture blackout

# Interactive mode
npm run fixture
> list                    # Show fixtures and groups
> color front red         # Set "front" group to red
> rgb all 255 128 0       # Set "all" group to orange
> off stage               # Turn off "stage" group
```

### Generating Fixtures

Use `npm run generate` to bulk-create and manage fixtures and groups:

```bash
# Create 20 RGBW fixtures named wash-1 through wash-20
npm run generate fixtures generic-rgbw 0 20 1 wash

# Create a group from all wash-* fixtures
npm run generate group all-wash "wash-*"

# Create a group from specific fixtures
npm run generate group front-wash "wash-1,wash-2,wash-3,wash-4"

# Remove fixtures (also removes from groups)
npm run generate remove fixtures "wash-*"

# Remove a group (keeps fixtures)
npm run generate remove group all-wash
```

### Flash Mode

Flash a group on/off at a specified interval:

```bash
npm run flash <group> [interval] [color]

# Examples:
npm run flash rgb-luster           # Every 3s, white
npm run flash rgb-luster 1         # Every 1s, white
npm run flash rgb-luster 0.5 blue  # Every 0.5s, blue
```

## Troubleshooting

1. If ping fails: Check laptop IP is 2.0.0.10 with subnet 255.0.0.0
2. If no Art-Net traffic: Ensure GrandMA2 Art-Net output is enabled
3. If discovery finds nothing: Some devices don't respond to ArtPoll - use sniffer instead
4. If channel control doesn't work: Verify universe number matches GrandMA2 config
