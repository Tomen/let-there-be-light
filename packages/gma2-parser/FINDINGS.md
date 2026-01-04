# GrandMA2 Show File Analysis

## Summary

This document describes the findings from reverse-engineering GrandMA2 `.show.gz` files.

**Current Status**:
- ✅ File structure understood
- ✅ Fixture names extracted (13 fixtures in sample)
- ✅ Fixture type library located (276 types)
- ✅ Group structure located (394 groups found)
- ✅ Port/DMX output structure located
- ❌ DMX addresses - NOT stored inline with fixtures (may require patch session)
- ⏳ Group memberships - structure found, fixture references unclear
- ⏳ Presets - names found but values not extracted

## File Format Overview

| Property | Value |
|----------|-------|
| Magic Header | `MA DATA\0` (8 bytes) |
| Compression | gzip |
| Endianness | Little-endian |
| String Format | Mixed: length-prefixed (4 bytes) OR null-terminated |

### Sample File: hillsong_september14.show.gz

| Property | Value |
|----------|-------|
| Compressed Size | 10.22 MB |
| Decompressed Size | 48.69 MB |
| MA Version | 3.9.60 |
| Timestamp | 2015-02-24 |

## File Structure Map

```
Offset Range        Content
─────────────────────────────────────────────────────
0x00000000-0x00002000   Header, version info
0x00002000-0x00003000   Show index, metadata, paths
0x00002550             "hillsong_september14" show name
0x00002620             "C:/ProgramData/MA Lighting..." path
0x00008000-0x00009000   Network/output configuration
0x00008a0a             "MA_FOHSWITCH" node
0x00008abf             Port 1-13 DMX output config
0x00008cea             Group01-Group06 (empty slots)
0x00009000-0x00050000   Fixture instances
0x00050000-0x00500000   Show-specific data (cues, effects, macros)
0x00970000-0x00A00000   Fixture type library (channel definitions)
0x00A00000-0x00D00000   More fixture types, presets
0x00D00000-0x02000000   User groups, sequences, executors
0x02000000+             Additional data, backups
```

## Port/DMX Output Structure

### Location

Port configuration starts at 0x8abf with 13 DMX output ports.

### Port Record Format

```
Offset  Size  Field          Example         Notes
─────────────────────────────────────────────────────
0       4     Name length    0x06            6 bytes
4       N     Name           "Port 1"        ASCII string
N+4     4     Type/mode      0x17 (23)       Configuration value
N+8     4     Flags          0x80 0x00 0x08  Mode flags
N+12    16    Reserved       0x00...         Padding
N+28    4     Value          0x01 0xff       Configuration
```

Ports 1-9 have 6-char names, Ports 10-13 have 7-char names.

### Observed Values

| Port | Type | Flags |
|------|------|-------|
| Port 1-9 | 0x17 | 0x80 0x00 0x08 |
| Port 10-12 | 0x17 | 0x80 0x01 0x08 |
| Port 13 | 0x17 | 0x80 0x00 0x08 |

## Group Structure

### System Groups (0x8cea)

Empty numbered slots for user assignment:

```
Offset  Field         Value
────────────────────────────
0x8ce6  Record type   0x08
0x8cea  Name length   0x07 (7)
0x8cee  Name          "Group01"
0x8cf5  Type          0x10 (16)
0x8cf9  Group ID      0x64 (100)
0x8cfd  Padding       zeros
0x8d00  Flag          0x01
```

Group IDs increment by 100: Group01=100, Group02=200, etc.

### User Groups (0xbc0000+)

User-defined groups with fixture members:

| Group Name | Offset | Member Count |
|------------|--------|--------------|
| Wash MHs | 0xbcfa68 | 4 |
| Wash DF 10 | 0xbcfab8 | - |
| All Robin100 weiss | 0xd123b9 | 4 |

### Group Membership Format (Hypothesis)

Group membership may use UTF-16LE encoded fixture addresses:
- "500.3" = Fixture 500, subfixture 3 (GrandMA2 notation)
- Wide strings observed at 0xd12410: `35 00 30 00 30 00 2e 00 33 00` = "500.3"

## Fixture Record Structure

### Marker Pattern

Fixture records are preceded by the marker `0x3eb98358` at offset -28 from name.

### Complete Layout Analysis

Based on analyzing PAR, Fresnel, Leko, Moving 1-4:

```
Offset   Size  Field                    Example Value       Notes
────────────────────────────────────────────────────────────────────
-48      4     Type marker              0x00000123 (291)    Consistent
-44      4     Next fixture pointer     0x0002c08a          Linked list
-40      4     Reserved                 0x00000000
-36      4     Fixture index + flags    0x10000002          High byte = ID
-32      4     Reserved                 0x00000000
-28      4     FIXTURE MARKER           0x5883b93e          Reversed bytes
-24      4     Reserved                 0x00000000
-20      4     Unknown                  0x5c010000
-16      4     Reserved                 0x00000000
-12      8     Hash/UUID                varies
-4       4     Name length              0x00000008
 0       N     Fixture name             "Moving 1"
+N       4     Type reference           0x00000001
+N+4     8     Values                   0x00f00000 x2
+N+12    4     Unknown                  0x00000040
+N+16    ...   Attribute defaults       0x0000ff00 x N
```

### Fixture Index Encoding (at -36 / -32)

| Fixture | Index Field | Decoded |
|---------|-------------|---------|
| PAR | 0x34100002 | Index 52, Type 0x100002 |
| Fresnel | 0x32100002 | Index 50, Type 0x100002 |
| Leko | 0x30100002 | Index 48, Type 0x100002 |
| Zoom Profile | 0x1c100002 | Index 28, Type 0x100002 |
| Blinder | 0x14000002 | Index 20, Type 0x000002 |
| 2Lite | 0x12000002 | Index 18, Type 0x000002 |
| Moving 1 | 0x10000002 | Index 16, Type 0x000002 |
| Moving 2 | 0x0e000002 | Index 14, Type 0x000002 |
| Moving 3 | 0x0c000002 | Index 12, Type 0x000002 |
| Moving 4 | 0x0a000002 | Index 10, Type 0x000002 |
| Strobe | 0x06000002 | Index 6, Type 0x000002 |

Two fixture categories observed:
- **Conventional (0x100002)**: PAR, Fresnel, Leko, Zoom Profile
- **Moving lights (0x000002)**: Blinder, 2Lite, Moving 1-4, Strobe

### Extracted Fixtures

| Name | Offset | Index |
|------|--------|-------|
| PAR | 0x9110 | 52 |
| Fresnel | 0xdf9e | 50 |
| Leko | 0x12e7c | 48 |
| Zoom Profile | 0x17d4e | 28 |
| Blinder | 0x1cbd6 | 20 |
| 2Lite | 0x21c16 | 18 |
| Moving 1 | 0x2721d | 16 |
| Moving 2 | 0x2c0c2 | 14 |
| Moving 3 | 0x30f55 | 12 |
| Moving 4 | 0x35de8 | 10 |
| Moving 5 | 0x3ac7b | 8 |
| Moving 6 | 0x3fb0e | 6 |
| Strobe | 0x449a1 | - |

## DMX Address Investigation

### Key Finding

**DMX addresses are NOT stored inline with fixture instance records.**

The fixture records contain:
- Fixture name
- Fixture index/ID
- Type reference
- Attribute defaults
- Link to next fixture

But NO universe or DMX address fields.

### Possible Explanations

1. **Not patched**: The show file may not have DMX addresses assigned
2. **Separate patch table**: Addresses stored in a different section
3. **Session-based**: Patch stored in session data, not show file
4. **Output mapping**: Addresses defined at output/port level

### Search Results

Exhaustive searches performed:
- No "Patch" or "DMXAddress" strings found in show data area
- No consistent fixture ID → address patterns found
- Port records contain hardware config, not fixture addresses

## Fixture Type Library

### Location

Fixture type definitions start at approximately 0x974000.

### Sample Entry: Robin 100 LEDBeam (0x990329)

```
Offset  Content
───────────────────────────────────
0       "Robin 100 LEDBeam" (17 chars)
+21     "R1LEDBm1" (8 chars, short name)
+33     "Robe" (4 chars, manufacturer)
+41     "Robe" (4 chars, repeated)
+49     "Mode 1" (6 chars, DMX mode name)
+59     Configuration data
+N      "Automated import from MA Lighting..."
```

### Extracted Types (276 total)

Includes: Generic Dimmer, Robin 100 LEDBeam, MAC 2000 Wash, Clay Paky Sharpy, etc.

## CLI Tools Reference

| Command | Purpose |
|---------|---------|
| `pnpm shows <file>` | List shows in file |
| `pnpm extract <file>` | Extract fixtures to YAML |
| `pnpm dump <file> <offset> <len>` | Hex dump at offset |
| `pnpm fixtures <file> analyze` | Analyze fixture records |
| `pnpm fixtures <file> list` | List fixtures with details |
| `pnpm search-types <file>` | Search fixture type names |
| `pnpm deep-search <file> [mode]` | Search DMX/groups/presets |
| `pnpm find-patch-table <file>` | Search for patch patterns |

## Extraction Status

| Data Type | Status | Notes |
|-----------|--------|-------|
| Fixture names | ✅ Extracted | 13 fixtures found |
| Fixture types | ✅ Extracted | 276 types in library |
| Fixture indices | ✅ Extracted | Linked list structure |
| DMX addresses | ❌ Not found | Not stored with fixtures |
| Group names | ✅ Extracted | 394 groups found |
| Group memberships | ⏳ Partial | UTF-16 fixture refs found |
| Color presets | ⏳ Partial | Names found |
| Position presets | ❌ Not found | |
| Cues/Sequences | ❌ Not found | |

## Technical Notes

### Endianness

All multi-byte values are little-endian:
- `08 00 00 00` = 8 (name length)
- `23 01 00 00` = 0x123 = 291

### String Encoding

Two formats observed:
1. **Length-prefixed (UTF-8)**: 4-byte length + string
2. **Wide strings (UTF-16LE)**: For fixture addresses in groups

### Record Alignment

Data appears to be 4-byte aligned.

### Embedded Content

- PNG images with ICC profiles (thumbnails, icons)
- IEND markers indicate image boundaries
- Photoshop CS6 metadata embedded

## Conclusions

1. **Show files store fixture definitions but may not include DMX patch data**
   - Fixtures are defined with names, types, and indices
   - DMX addresses appear to be stored elsewhere (possibly session files)

2. **Groups reference fixtures using GrandMA2's decimal notation**
   - "500.3" format in UTF-16LE encoding
   - Fixture indices map to these addresses

3. **The file format is a complex nested structure**
   - Multiple data sections with different encodings
   - Linked list navigation between records
   - Pointers to related data throughout

## Future Investigation

1. Compare multiple show files to find patch data
2. Analyze GrandMA2 session files (.session)
3. Look for "Stage" or output layer configuration
4. Check if newer MA versions store data differently
