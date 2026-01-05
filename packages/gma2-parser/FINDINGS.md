# GrandMA2 Show File Analysis

## Summary

This document describes the findings from reverse-engineering GrandMA2 `.show.gz` files.

**Current Status**:
- ✅ File structure understood
- ✅ Show index structure decoded (multiple shows per file)
- ✅ Fixture TYPES extracted (12 types: PAR, Moving 1-4, etc.)
- ✅ Fixture type library located (276 types)
- ✅ Group structure located (394 groups found)
- ✅ Port/DMX output structure located
- ✅ 3-channel address table found (0xc00c89)
- ✅ Fixture-to-index mapping table found (0x27d0)
- ⏳ DMX patch table - partial structures found, full table unclear
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
| Shows in File | 20+ (including multiple Hillsong versions) |

## Shows Contained in File

The file contains multiple shows spanning 2014-2025:

| Show Name | Name Offset | Offset1 | Offset2 |
|-----------|-------------|---------|---------|
| palais berg v1.7 | 0x2011 | 0xef4f | 0xb42fd |
| palais berg v2.0 | 0x20b9 | 0xbb54 | 0xb4334 |
| hillsong wien basic april 2022 | 0x21bc | 0x10a46 | 0xb4542 |
| hillsong wien std 1.0 | 0x221e | 0x98e7 | 0xb457b |
| hillsong wien (tommys version) | 0x22d0 | 0xb891 | 0xb487d |
| hillsong wien - 2025-03 | 0x2332 | 0x6ec9 | 0xb4964 |
| hillsong wien - 2025-05 | 0x238d | 0x704f | 0xb49a3 |
| hillsong backup 2025-07 | 0x23e8 | 0x9529 | 0xb49e9 |
| hillsong live | 0x2443 | 0x8ad9 | 0xb49f0 |
| hillsong_september14 | 0x2494 | 0xb8f0 | 0xb4a21 |

## File Structure Map

```
Offset Range        Content
─────────────────────────────────────────────────────
0x00000000-0x00002000   Header, version info
0x00002000-0x00002800   Show index (names, offsets, metadata)
0x00002550             "hillsong_september14" show name
0x00002620             "C:/ProgramData/MA Lighting..." path
0x000027d0             Fixture index → type mapping table
0x00007f00-0x00008500   Patch records (64 00 18 00 header)
0x00008a0a             "MA_FOHSWITCH" node
0x00008abf             Port 1-13 DMX output config
0x00008cea             Group01-Group06 (empty slots)
0x00009000-0x00050000   Fixture type instances
0x00050000-0x00500000   Show-specific data (cues, effects, macros)
0x00970000-0x00A00000   Fixture type library (channel definitions)
0x00A00000-0x00D00000   More fixture types, presets
0x00c00c89             3-channel address table
0x00D00000-0x02000000   User groups, sequences, executors
0x02000000+             Additional data, backups
```

## Show Index Structure (0x2000)

Each show entry follows this 28-byte record format:

```
Offset  Size  Field              Notes
──────────────────────────────────────────────────────
-20     2     Record type        0x03 0x00 or 0x41 0x3c
-18     2     Flags              0x09 0x03
-14     4     Zeros              Padding
-10     4     Offset1            Points to show-specific data (~30-70 KB)
-6      4     Offset2            Points to shared data (~720 KB)
-2      4     Name length        Length of show name string
0       N     Show name          Null-terminated ASCII
N       ...   Padding            Align to next record
```

### Show Index Record Example

```
hillsong wien basic april 2022 @ 0x21bc:
  Before: 03 00 09 03 00 00 00 00 46 0a 01 00 42 45 0b 00 1e 00 00 00
          |        |              |          |          |
          |        |              |          |          Name len (30)
          |        |              |          Offset2 (0x0b4542)
          |        |              Offset1 (0x010a46)
          |        Marker (09 03 00 00 00 00)
          Type (03 00)
```

## Fixture Index Mapping Table (0x27d0)

8-byte records mapping sequential indices to fixture type IDs:

```
Offset     u32 Index    u32 Type ID
────────────────────────────────────
0x27d0     1            86 (0x56)
0x27d8     2            87 (0x57)
0x27e0     3            88 (0x58)
0x27e8     4            89 (0x59)
0x27f0     5            90 (0x5a)
...
```

Pattern: Sequential indices 1, 2, 3... mapped to fixture type IDs 86, 87, 88...

These appear to be internal fixture type references, not DMX addresses.

## Patch Record Structure (0x7f00-0x8500)

28-byte records with consistent header:

```
Offset  Size  Field        Value           Notes
────────────────────────────────────────────────────
0       2     Constant     0x0064 (100)    Always 100
2       2     Constant     0x0018 (24)     Always 24
4       6     Padding      0x000000000000  Zeros
10      4     Universe     0, 1, or 2      0-indexed (0=U1, 2=U3)
14      4     Index        1, 2, 3...      Incrementing per universe
18      10    Padding      0x00...         Zeros
```

### Observed Entries

| Universe | Count | Index Range | Notes |
|----------|-------|-------------|-------|
| 0 (U1) | 5 | 0 | Only zeros found |
| 1 (U2) | 3 | 0 | Only zeros found |
| 2 (U3) | 53 | 1-9 | Sequential with gaps |

**Note**: This appears to be a partial patch table. Full patch data may be elsewhere or in newer shows.

## 3-Channel Address Table (0xc00c89)

18-byte records containing 3-channel fixture DMX assignments:

```
Hex dump:
0x00c00c89  01 00 0c 00 0d 00 02 00 0c 00 04 00 03 00 0e 00 0f 00

Record structure (9 × u16):
  Field 0: DMX address (1, 4, 7, 10... 3-channel spacing)
  Field 1-8: Additional channel/attribute references
```

### Address Pattern Analysis

```
Record 0: DMX addr=1,  fields=[1, 12, 13, 2, 12, 4, 3, 14, 15]
Record 1: DMX addr=4,  fields=[4, 14, 6, 5, 16, 17, 6, 16, 8]
Record 2: DMX addr=7,  fields=[7, 18, 19, 8, 18, 10, 9, 20, 21]
Record 3: DMX addr=10, fields=[10, 20, 12, 11, 22, 23, 12, 22, 14]
...
```

**Key Finding**: Field 0 contains the expected 3-channel DMX address sequence (1, 4, 7, 10, 13...).
This matches the user's intel about Universe 3 having 3-channel fixtures.

Valid consecutive records: 7 (addresses 1-19)
Then pattern breaks with gaps/jumps.

## Fixture Type Records

The file contains 12 fixture TYPES (not patched instances):

| Type Name | Marker Offset | Notes |
|-----------|---------------|-------|
| PAR | 0x90f2 | Generic conventional |
| Fresnel | 0xdf7a | Conventional |
| Leko | 0x12e58 | Conventional |
| Zoom Profile | 0x17d2a | Conventional |
| Blinder | 0x1cbb2 | Effect |
| Moving 1 | 0x271f9 | Moving light |
| Moving 2 | 0x2c09e | Moving light |
| Moving 3 | 0x30f31 | Moving light |
| Moving 4 | 0x35dc4 | Moving light |
| Scanner | 0x3ac57 | Moving light |
| Strobe | 0x3f208 | Effect |
| Smoke | 0x43fb1 | Atmospheric |

**Important**: These are fixture TYPES (templates), not the ~200 patched fixture instances.
The actual patched fixtures (100 on U1, 100 on U3) are stored in a separate patch section.

### Fixture Marker Pattern

Fixture records are identified by marker `0x3eb98358` at offset -28 from name:

```
-28     4     MARKER              0x3eb98358 (LE: 3e b9 83 58)
-24     4     Reserved            0x00000000
-20     4     Unknown             0x5c010000
-16     4     Reserved            0x00000000
-12     8     Hash/UUID           Varies per fixture
-4      4     Name length         e.g., 0x00000008
 0      N     Fixture name        "Moving 1"
```

## User Intel About DMX Configuration

Per user input, the expected configuration for newer shows (2025):

| Universe | Fixture Count | Channels Each | Address Pattern |
|----------|---------------|---------------|-----------------|
| 1 (U1) | ~100 | 1 | 1, 2, 3, 4, 5... |
| 3 (U3) | ~100 | 3 | 1, 4, 7, 10, 13... |

**Hypothesis**: Fixture IDs may encode universe+channel:
- Universe 3, Channel 1 → Fixture ID 2001 (if universe 0-indexed: 2*1000 + 1)
- This pattern was NOT found in exhaustive searches

## Port/DMX Output Structure

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

User-defined groups with fixture members.

## CLI Tools Reference

### Core Tools
| Command | Purpose |
|---------|---------|
| `pnpm dump <file> <offset> <len>` | Hex dump at offset |
| `pnpm shows <file>` | List shows in file |
| `pnpm inspect <file>` | Interactive structure exploration |
| `pnpm extract <file>` | Extract fixtures to YAML |

### Fixture Analysis
| Command | Purpose |
|---------|---------|
| `pnpm fixtures <file>` | Analyze fixture type records |
| `pnpm search-types <file>` | Search fixture type names |
| `pnpm find-fixtures-by-name <file>` | Find fixtures by name patterns |
| `pnpm analyze-fixture-dmx <file>` | Analyze fixture DMX encoding |
| `pnpm analyze-patched-fixtures <file>` | Analyze patched fixture records (0xbc0000+) |

### Show Analysis
| Command | Purpose |
|---------|---------|
| `pnpm compare-shows <file>` | Compare two shows for differences |
| `pnpm analyze-show-index <file>` | Analyze show index structure |
| `pnpm follow-show-offsets <file>` | Follow show index pointers |

### Patch Extraction
| Command | Purpose |
|---------|---------|
| `pnpm extract-full-patch <file>` | Extract 28-byte patch index records |
| `pnpm decode-3ch-table <file>` | Decode 3-channel address table |
| `pnpm analyze-0x8000 <file>` | Analyze patch region at 0x8000 |

*Deprecated scripts archived in `src/cli/_archive/`*

## Patched Fixture Records (0xbc0000+)

User-created fixtures (patched instances) are stored separately from fixture types:

### Location

Named fixtures found at offset 0xbc0000+:
- "Spot MH5 Stage 1", "Spot MH5 Stage 2", etc.
- "Par Niesche 1", "Par Niesche 2", etc.
- "Par Disco-Bereich 1", etc.

### Record Structure (approximate 744-byte spacing)

```
Offset  Size  Field          Notes
──────────────────────────────────────────────────────
-32     4     Next pointer   Points to next fixture record
-28     4     Zeros
-24     4     Timestamp?     0x6947b595 or similar
-20     4     Zeros
-16     4     Flags          0x80010000 constant
-12     4     Zeros
-8      4     Zeros
-4      4     Zeros
0       4     Name length    e.g., 0x10 (16)
4       N     Fixture name   "Spot MH5 Stage 1"
N+4     4     Fixture ID     Incrementing: 0x6f, 0x70, 0x71 (111, 112, 113)
```

### Key Findings

- **61 patched fixtures found** with names like "Spot MH5 Stage N", "Par Niesche N"
- **Fixture IDs** increment sequentially (111, 112, 113...)
- These are **user-created fixtures** referencing fixture types (templates)
- DMX address is NOT stored directly in this record; it's likely derived from fixture type channel count and a separate address table

## Patch Index Records (0x7f00-0x8900)

28-byte records mapping universe to fixture index:

```
Offset  Size  Field         Value
──────────────────────────────────────
0       2     Constant      0x0064 (100)
2       2     Constant      0x0018 (24)
4       6     Zeros
10      4     Universe      0=U1, 1=U2, 2=U3
14      4     Fixture Index 1, 2, 3... (NOT DMX address)
18      10    Zeros
```

### DMX Address Calculation

The fixture index is NOT the DMX address. DMX address is calculated:
- **Universe 1** (1-channel fixtures): `DMX = index`
- **Universe 3** (3-channel fixtures): `DMX = (index - 1) * 3 + 1`

Example for U3:
| Index | DMX Address |
|-------|-------------|
| 1 | 1 |
| 2 | 4 |
| 3 | 7 |
| 4 | 10 |

### Current Findings

- **53 patch index records found** for Universe 2 (U3)
- Records scattered across 0x7a89 to 0x88f8
- Universe 0 (U1) records **not found** - may use different format

### Validation Notes (Jan 2026)

- **Fixture names confirmed correct** - "Spot MH5 Stage N", "Par Niesche N", etc.
- **User reports >100 fixtures on U3** - only 53 records found
- File contains multiple shows (2014-2025), patch data may differ by version
- Need to isolate specific show's patch section for complete extraction

## Extraction Status

| Data Type | Status | Notes |
|-----------|--------|-------|
| Show index | ✅ Extracted | 13+ shows with offsets |
| Fixture types | ✅ Extracted | 12 types (PAR, Moving 1-4, etc.) |
| Fixture library | ✅ Extracted | 276 types in library |
| 3-ch address table | ✅ Found | At 0xc00c89, 7 valid records |
| Patch index records | ⏳ Partial | 53 records for U3, U1 format unknown |
| Patched fixtures | ✅ Found | 61 named fixtures at 0xbc0000+ |
| Fixture-index map | ✅ Found | At 0x27d0 |
| DMX addresses | ⏳ Calculated | Derived from fixture index + channel count |
| Group names | ✅ Extracted | 394 groups found |
| Group memberships | ⏳ Partial | Fixture IDs reference patched fixtures |
| Color presets | ⏳ Partial | Names found |
| Position presets | ❌ Not found | |
| Cues/Sequences | ❌ Not found | |

## Technical Notes

### Endianness

All multi-byte values are little-endian:
- `08 00 00 00` = 8 (name length)
- `23 01 00 00` = 0x123 = 291
- `3e b9 83 58` = 0x5883b93e (fixture marker)

### String Encoding

Two formats observed:
1. **Length-prefixed (UTF-8)**: 4-byte length + string
2. **Wide strings (UTF-16LE)**: For fixture addresses in groups

### Record Alignment

Data appears to be 4-byte aligned.

## Conclusions

1. **Show files contain multiple shows with separate data sections**
   - Each show has two offset pointers (offset1 ~30-70KB, offset2 ~720KB)
   - offset1 points to color palette data
   - offset2 points to shared show data

2. **Three-layer fixture architecture**
   - **Fixture Types** (12 templates): PAR, Moving 1-4, Fresnel, etc. (0x9000-0x44000)
   - **Fixture Library** (276 types): Manufacturer fixtures at 0x970000+
   - **Patched Fixtures** (61 instances): User-created fixtures at 0xbc0000+

3. **Patch index records link universes to fixtures**
   - 28-byte records with universe and fixture index
   - DMX address calculated: `(index - 1) * channels + 1`
   - Only Universe 3 records found; Universe 1 may use different format

4. **Patched fixtures have sequential IDs**
   - IDs increment: 111, 112, 113... (0x6f, 0x70, 0x71)
   - Groups reference fixtures by these IDs
   - Names like "Spot MH5 Stage 1", "Par Niesche 1"

5. **DMX addresses are calculated, not stored directly**
   - Universe 1: 1-channel fixtures → `DMX = index`
   - Universe 3: 3-channel fixtures → `DMX = (index - 1) * 3 + 1`

## Future Investigation

1. **Find Universe 1 patch records** - different format from U3?
2. **Link patched fixtures to patch index records**
3. **Extract fixture type reference from patched fixtures**
4. **Build complete fixture → DMX address mapping**
5. **Extract group → fixture membership from IDs**
6. **Export to YAML format for Let There Be Light**
