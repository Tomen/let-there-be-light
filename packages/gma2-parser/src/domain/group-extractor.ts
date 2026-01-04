/**
 * Group extraction from GrandMA2 show files
 */
import { BinaryReader } from '../binary/reader.js';
import { scanForStrings } from '../binary/record-parser.js';
import type { ExtractedGroup } from './types.js';

/**
 * Scan for groups in the buffer
 */
export function scanForGroups(
  buffer: Buffer,
  startOffset = 0,
  endOffset = buffer.length
): ExtractedGroup[] {
  const groups: ExtractedGroup[] = [];
  const seen = new Set<string>();

  // Get all strings from the buffer
  const strings = scanForStrings(buffer, 4, 64);

  // Filter for group-like strings
  for (const s of strings) {
    if (s.offset < startOffset || s.offset > endOffset) continue;

    const name = s.value.trim();
    if (!name || seen.has(name)) continue;

    // Skip if in fixture type library (0x970000+) unless it's specifically a group
    if (s.offset >= 0x970000 && s.offset < 0xA00000) continue;

    // Check if this looks like a group name
    if (!isGroupName(name)) continue;

    seen.add(name);

    // Try to extract group metadata from surrounding bytes
    const groupInfo = parseGroupContext(buffer, s.offset, name);

    groups.push({
      offset: s.offset,
      name,
      fixtureIds: [], // Cannot reliably extract fixture memberships
      groupId: groupInfo.id,
      groupType: groupInfo.type,
    });
  }

  return groups;
}

/**
 * Check if a string looks like a group name
 */
function isGroupName(name: string): boolean {
  const lower = name.toLowerCase();

  // System group patterns
  if (/^Group\d+$/i.test(name)) return true;
  if (/^Group\s+\d+$/i.test(name)) return true;

  // Common group naming patterns
  const groupPatterns = [
    /^All\s+/i,          // "All Wash", "All Beam"
    /^Front\s+/i,        // "Front Left", "Front Wash"
    /^Back\s+/i,         // "Back Right"
    /^Side\s+/i,         // "Side Left"
    /^Stage\s+/i,        // "Stage Left"
    /^(Wash|Beam|Spot)\s+(MH|DF|Stage)/i,  // "Wash MHs", "Beam Stage"
    /^\w+\s+\d+$/,       // "Wash 10", "Spot 20"
  ];

  if (groupPatterns.some(p => p.test(name))) return true;

  // Keywords that suggest groups
  const groupKeywords = [
    'group', 'all', 'wash', 'beam', 'spot', 'mh', 'stage',
    'left', 'right', 'front', 'back', 'top', 'bottom',
    'preset', 'master', 'trunk',
  ];

  const hasGroupKeyword = groupKeywords.some(kw => lower.includes(kw));
  if (hasGroupKeyword && name.length > 3 && name.length < 40) {
    return true;
  }

  return false;
}

/**
 * Parse group context from surrounding bytes
 */
function parseGroupContext(
  buffer: Buffer,
  nameOffset: number,
  name: string
): { id: number; type: string } {
  // Try to find group ID after the name
  const afterName = nameOffset + name.length + 4;
  let id = 0;
  let type = 'user';

  if (afterName + 8 < buffer.length) {
    // Check for type marker (0x10 = 16 is common for groups)
    const typeMarker = buffer.readUInt32LE(afterName);
    if (typeMarker === 0x10) {
      // Read potential group ID
      const potentialId = buffer.readUInt32LE(afterName + 4);
      if (potentialId < 100000) {
        id = potentialId;
      }
    }
  }

  // Determine type from name
  if (/^Group\d+$/i.test(name)) {
    type = 'slot';
  } else if (/^(Trunk|Manage|Master)/i.test(name)) {
    type = 'system';
  } else if (/^All\s+/i.test(name)) {
    type = 'all';
  }

  return { id, type };
}

/**
 * Extract user-defined groups (non-empty slots)
 */
export function extractUserGroups(groups: ExtractedGroup[]): ExtractedGroup[] {
  return groups.filter(g => {
    // Skip empty slot groups
    if (g.groupType === 'slot') return false;

    // Skip system groups
    if (g.groupType === 'system') return false;

    return true;
  });
}
