# GrandMA2 Show File Reverse Engineering Project

## Project Context

You are extending an existing npm-based Art-Net diagnostics application to include the ability to parse and extract data from GrandMA2 show files. The goal is to reverse-engineer the proprietary show file format to enable offline analysis, visualization, and potentially conversion to other formats.

---

## What We Know About GrandMA2 Show Files

### File Format Basics

| Property | Details |
|----------|---------|
| **Extension** | `.show` or `.show.gz` |
| **Compression** | GZIP compressed (standard gzip, can be decompressed with `zlib`) |
| **Location (Windows)** | `C:\ProgramData\MA Lighting Technologies\grandma\gma2_V_X.X\shows\` |
| **Location (USB)** | `gma2/shows/` folder structure |

### After Decompression

When you decompress a `.show.gz` file, the internal structure needs to be analyzed. Based on the export functionality, the show file likely contains serialized versions of:

- **Patch data** - Fixtures, channels, universes, DMX addresses
- **Sequences** - Cue lists with timing and tracking data
- **Presets** - Color, position, gobo, beam presets
- **Effects** - Effect definitions and parameters
- **Macros** - Command macros
- **Groups** - Fixture groupings
- **Layouts** - Stage layouts and positions
- **Images/Media** - Bitmap references, gobo images
- **User profiles** - User settings and views
- **Executors** - Executor assignments and configurations
- **Timecode** - Timecode show data

### XML Export Schema

GrandMA2 exports components as XML files that follow a documented schema:

```xml
<?xml version="1.0" encoding="utf-8"?>
<MA xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xmlns="http://schemas.malighting.de/grandma2/xml/MA" 
    xsi:schemaLocation="http://schemas.malighting.de/grandma2/xml/MA 
    http://schemas.malighting.de/grandma2/xml/3.1.2/MA.xsd"
    major_vers="3" minor_vers="1" stream_vers="2">
    <Info datetime="..." showfile="..."/>
    <!-- Content varies by export type -->
</MA>
```

**Key namespace:** `http://schemas.malighting.de/grandma2/xml/MA`
**XSD Schema:** `http://schemas.malighting.de/grandma2/xml/{version}/MA.xsd`

### Fixture Library Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| **XML** | `.xml` | Human-readable, editable fixture definitions |
| **XMLP** | `.xmlp` | Compressed/encoded fixture library (internal format) |
| **PXML** | `.pxml` | GrandMA2 fixtures as seen in GrandMA3 |

---

## Reverse Engineering Strategy

### Phase 1: Initial Analysis

1. **Decompress the file:**
   ```javascript
   const zlib = require('zlib');
   const fs = require('fs');
   
   const compressed = fs.readFileSync('showfile.show.gz');
   const decompressed = zlib.gunzipSync(compressed);
   fs.writeFileSync('showfile.show.raw', decompressed);
   ```

2. **Analyze the binary structure:**
   - Check for magic bytes / file signatures
   - Look for XML fragments embedded in binary
   - Identify potential SQLite database headers (`SQLite format 3\x00`)
   - Check for tar/archive structure
   - Map repeating patterns and offsets

3. **Compare multiple show files:**
   - Create minimal show files (empty, one fixture, one cue)
   - Diff the binary to identify what changes
   - Build understanding of structure incrementally

### Phase 2: Data Extraction

Based on what MA Lighting exposes through exports, prioritize extracting:

1. **Patch Information** (highest value for Art-Net diagnostics)
   - Universe assignments
   - DMX addresses
   - Fixture types and modes
   - Channel counts

2. **Sequence/Cue Data**
   - Cue numbers and names
   - Timing information
   - Tracking data

3. **Fixture Library References**
   - Which fixtures are used
   - Attribute mappings

### Phase 3: Integration

- Parse extracted data into JavaScript objects
- Map to your existing Art-Net diagnostic data structures
- Provide analysis/comparison tools

---

## Known Tools & Libraries

### Directly Relevant

| Project | URL | Notes |
|---------|-----|-------|
| **Open Fixture Library** | https://github.com/OpenLightingProject/open-fixture-library | Node.js fixture library with plugin architecture. Has GrandMA2 XML schema references. Issue #141 discusses MA Lighting plugin. |
| **MIDIMonster maweb backend** | https://github.com/cbdevnet/midimonster/blob/master/backends/maweb.md | Reverse-engineered MA Web Remote protocol. Shows how to interact with running console. |
| **GrandMA2 API Documentation (Lua)** | https://github.com/MacTirney/GrandMA2-API-Documentation | Community-documented Lua API for plugins. Useful for understanding internal object model. |
| **gma2.lua.importCSVPatch** | https://github.com/schw4rzlicht/gma2.lua.importCSVPatch | Lua plugin showing how to interact with patch data. |
| **Moving Light Assistant** | https://www.manula.com/manuals/avld/mla/131/en/topic/exporting-grandma-2-data | Commercial tool that imports GrandMA2 XML exports. |

### GDTF/MVR Ecosystem (Related Standards)

| Project | URL | Notes |
|---------|-----|-------|
| **GDTF Hub Projects List** | https://www.gdtf.eu/docs/list-of-projects/ | Comprehensive list of GDTF/MVR parsers in various languages |
| **MVRGDTF.js** | npm package | TypeScript parser for MVR and GDTF files |
| **pyGDTF** | Python | MIT-licensed GDTF parser |
| **GDTFSharp** | C# | MIT-licensed GDTF implementation |

### Console Communication

| Protocol | Port | Notes |
|----------|------|-------|
| **Telnet** | 30000 | Full command line access, login required |
| **Telnet Read-Only** | 30001 | Read-only access |
| **Web Remote** | HTTP | Browser-based control interface |
| **Art-Net** | 6454 | Standard DMX over IP |
| **sACN** | 5568 | E1.31 streaming ACN |

---

## Technical Reference

### GrandMA2 Software Versions & Paths

```
Windows onPC paths:
- Shows: C:\ProgramData\MA Lighting Technologies\grandma\gma2_V_X.X\shows\
- Library: C:\ProgramData\MA Lighting Technologies\grandma\gma2_V_X.X\library\
- Plugins: C:\ProgramData\MA Lighting Technologies\grandma\gma2_V_X.X\plugins\
- Import/Export: C:\ProgramData\MA Lighting Technologies\grandma\gma2_V_X.X\importexport\

USB structure:
gma2/
├── shows/
├── library/
├── plugins/
├── importexport/
└── images/
```

### MA XML Elements (from exports)

Common elements found in XML exports:
- `<FixtureType>` - Fixture definitions with channels, attributes
- `<Fixture>` - Individual fixture instances with patch info
- `<Sequence>` - Cue sequences
- `<Cue>` - Individual cues with values
- `<Preset>` - Preset data (color, position, gobo, etc.)
- `<Effect>` - Effect definitions
- `<Macro>` - Macro definitions with command lines
- `<Group>` - Fixture groups
- `<Timecode>` - Timecode events

### Attribute System

GrandMA2 uses a hierarchical attribute system:
- **Dimmer** - Intensity
- **Position** - Pan, Tilt, PanRotate, TiltRotate
- **Gobo** - Gobo1, Gobo2, Gobo1Pos, Gobo2Pos
- **Color** - ColorRGB, ColorMix, CTO, CTC
- **Beam** - Zoom, Focus, Iris, Frost, Prism
- **Control** - Shutter, Strobe, Control, Reserved

---

## Suggested Implementation Approach

### 1. Start with XML Export Analysis

Before tackling the binary show file, thoroughly analyze XML exports:

```javascript
// Install GrandMA2 onPC (free)
// Create a test show with known fixtures
// Export all components to XML
// Build parser for known XML structure first

const xml2js = require('xml2js');
const fs = require('fs');

async function parseMAExport(filepath) {
  const xml = fs.readFileSync(filepath, 'utf-8');
  const parser = new xml2js.Parser({
    xmlns: true,
    explicitArray: false
  });
  return await parser.parseStringPromise(xml);
}
```

### 2. Binary Analysis Tools

```javascript
// Hex dump utility
function hexDump(buffer, offset = 0, length = 256) {
  const slice = buffer.slice(offset, offset + length);
  let output = '';
  for (let i = 0; i < slice.length; i += 16) {
    const hex = slice.slice(i, i + 16)
      .toString('hex')
      .match(/.{2}/g)
      .join(' ');
    const ascii = slice.slice(i, i + 16)
      .toString('ascii')
      .replace(/[^\x20-\x7E]/g, '.');
    output += `${(offset + i).toString(16).padStart(8, '0')}  ${hex.padEnd(48)}  ${ascii}\n`;
  }
  return output;
}

// Check for known signatures
function detectFormat(buffer) {
  const signatures = {
    'SQLite format 3': 'sqlite',
    '<?xml': 'xml',
    'PK': 'zip',
    '\x1f\x8b': 'gzip',
    'BZh': 'bzip2'
  };
  
  const header = buffer.slice(0, 20).toString('ascii');
  for (const [sig, format] of Object.entries(signatures)) {
    if (header.includes(sig)) return format;
  }
  return 'unknown';
}
```

### 3. Create Test Fixtures

Use GrandMA2 onPC to create controlled test cases:

1. **Empty show** - Baseline binary
2. **Single dimmer** - Minimal fixture
3. **Single dimmer + 1 cue** - Add cue data
4. **Complex fixture** - Moving light with all attributes
5. **Multiple universes** - Test universe data structure

Compare binaries to isolate specific data structures.

---

## Useful Resources

### Official Documentation
- MA Lighting Help: https://help.malighting.com/grandMA2/
- Fixture Share: https://www.malighting.com/training-support/fixture-shares/
- MA Forum: https://forum.malighting.com/

### Community Resources
- Consoletrainer: https://consoletrainer.com/ (tutorials, example files)
- ACT Lighting Support: https://support.actentertainment.com/

### Software Downloads
- GrandMA2 onPC: https://www.malighting.com/downloads/products/grandma2/
- MA 3D Visualizer: Same download page

---

## Legal Considerations

- This reverse engineering is for interoperability purposes
- Do not redistribute proprietary fixture libraries
- GrandMA2 onPC is free to download and use
- XML exports are explicitly provided by MA Lighting for data exchange
- The show file format itself is not documented or licensed for third-party use

---

## Next Steps

1. [ ] Obtain show file
2. [ ] Export all components as XML for reference
3. [ ] Decompress show file and analyze structure
4. [ ] Document findings in structured format
5. [ ] Build initial parser for identified structures
6. [ ] Integrate with existing Art-Net diagnostics project
7. [ ] Add visualization/reporting features

---

## Questions to Answer Through Analysis

1. Is the show file a single binary blob or an archive (tar, zip)?
2. Are there embedded XML sections or is it purely binary?
3. Is there a SQLite database involved?
4. How is fixture data serialized?
5. How are DMX values stored (per-cue tracking)?
6. What compression/encoding is used internally?
7. Are there version markers we need to handle?
8. How do universe and fixture IDs map to DMX addresses?