# Claude.md - Art-Net Diagnostics Toolkit

## Project Overview

This is an Art-Net diagnostics toolkit for controlling church lighting via a GrandMA2 console. It provides 5 progressive diagnostic tools to verify network connectivity and control DMX lighting fixtures.

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

## Key Files

- `src/artnet-protocol.ts` - Art-Net packet building/parsing
- `src/config.ts` - Configuration loader
- `src/1-connectivity-test.ts` - Ping test
- `src/2-artnet-sniffer.ts` - Packet sniffer
- `src/3-artnet-discovery.ts` - Device discovery
- `src/4-single-channel.ts` - Single channel control
- `src/5-interactive-control.ts` - Interactive CLI

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

## Planned: Fixture Models

Fixtures will be defined by brand-model identifier with channel maps:

```yaml
models:
  brand-model:
    brand: "Brand"
    model: "Model"
    channels: [red, green, blue, white, strobe, mode]

fixtures:
  - name: "Stage Left Wash"
    model: brand-model
    universe: 0
    startChannel: 1
```

## Troubleshooting

1. If ping fails: Check laptop IP is 2.0.0.10 with subnet 255.0.0.0
2. If no Art-Net traffic: Ensure GrandMA2 Art-Net output is enabled
3. If discovery finds nothing: Some devices don't respond to ArtPoll - use sniffer instead
4. If channel control doesn't work: Verify universe number matches GrandMA2 config
