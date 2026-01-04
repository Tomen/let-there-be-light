#!/usr/bin/env tsx
/**
 * Art-Net MCP Server
 *
 * Exposes DMX control as MCP tools for Claude to invoke.
 *
 * Tools:
 *   - setChannel: Set a single DMX channel
 *   - setAll: Set all 512 channels in a universe
 *   - blackout: Set all channels to 0
 *   - startOutput: Begin continuous Art-Net transmission
 *   - stopOutput: Stop transmission
 *   - getStatus: Get current DMX state
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getController, shutdownController, getFixtureStore, NAMED_COLORS } from '@let-there-be-light/tools';

const server = new McpServer({
  name: 'artnet',
  version: '1.0.0',
});

// Tool: setChannel
server.tool(
  'setChannel',
  'Set a single DMX channel value',
  {
    universe: z.number().int().min(0).max(32767).describe('Universe number (0-32767)'),
    channel: z.number().int().min(1).max(512).describe('DMX channel (1-512)'),
    value: z.number().int().min(0).max(255).describe('DMX value (0-255)'),
  },
  async ({ universe, channel, value }) => {
    const controller = await getController();
    const result = controller.setChannel(universe, channel, value);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: setAll
server.tool(
  'setAll',
  'Set all 512 channels in a universe to the same value',
  {
    universe: z.number().int().min(0).max(32767).describe('Universe number (0-32767)'),
    value: z.number().int().min(0).max(255).describe('DMX value (0-255)'),
  },
  async ({ universe, value }) => {
    const controller = await getController();
    const result = controller.setAll(universe, value);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: blackout
server.tool(
  'blackout',
  'Set all channels to 0 (blackout)',
  {
    universes: z
      .array(z.number().int().min(0).max(32767))
      .optional()
      .describe('Specific universes to blackout (optional, defaults to all active)'),
  },
  async ({ universes }) => {
    const controller = await getController();
    const result = controller.blackout(universes);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: startOutput
server.tool(
  'startOutput',
  'Start continuous Art-Net DMX transmission',
  {},
  async () => {
    const controller = await getController();

    if (controller.isOutputting) {
      return {
        content: [{ type: 'text', text: 'Art-Net output is already running' }],
      };
    }

    controller.startOutput();
    return {
      content: [{ type: 'text', text: 'Art-Net output started' }],
    };
  }
);

// Tool: stopOutput
server.tool(
  'stopOutput',
  'Stop Art-Net transmission (sends blackout first)',
  {},
  async () => {
    const controller = await getController();

    if (!controller.isOutputting) {
      return {
        content: [{ type: 'text', text: 'Art-Net output is not running' }],
      };
    }

    controller.stopOutput();
    return {
      content: [{ type: 'text', text: 'Art-Net output stopped (blackout sent)' }],
    };
  }
);

// Tool: getStatus
server.tool(
  'getStatus',
  'Get current DMX state and output status',
  {
    universe: z
      .number()
      .int()
      .min(0)
      .max(32767)
      .optional()
      .describe('Specific universe to query (optional, defaults to all active)'),
  },
  async ({ universe }) => {
    const controller = await getController();
    const status = controller.getStatus(universe);

    const lines: string[] = [
      `Output: ${status.isOutputting ? 'Active' : 'Stopped'} (${status.refreshRateHz} Hz)`,
      `Target: ${status.targetAddress}:${status.targetPort}`,
      '',
    ];

    if (status.universes.length === 0) {
      lines.push('No universes active');
    } else {
      for (const u of status.universes) {
        lines.push(`Universe ${u.universe}:`);
        if (u.activeChannels === 0) {
          lines.push('  All channels at 0 (blackout)');
        } else {
          lines.push(`  ${u.activeChannels} active channel(s)`);
          if (u.firstActive !== null) {
            lines.push(`  First active: ch${u.firstActive} = ${u.channelValues[u.firstActive - 1]}`);
          }
          if (u.lastActive !== null && u.lastActive !== u.firstActive) {
            lines.push(`  Last active: ch${u.lastActive} = ${u.channelValues[u.lastActive - 1]}`);
          }
        }
      }
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }
);

// Tool: listFixtures
server.tool(
  'listFixtures',
  'List all fixtures and groups from fixtures.yaml',
  {},
  async () => {
    try {
      const fixtureStore = getFixtureStore();
      fixtureStore.load();

      const fixtures = fixtureStore.getAllFixtures();
      const groupNames = fixtureStore.getGroupNames();

      const lines: string[] = ['Fixtures:'];

      if (fixtures.length === 0) {
        lines.push('  No fixtures defined');
      } else {
        for (const fixture of fixtures) {
          const channels = Object.keys(fixture.model.channels).join(', ');
          lines.push(`  ${fixture.name} - ${fixture.model.brand} ${fixture.model.model}`);
          lines.push(`    Universe ${fixture.universe}, Ch ${fixture.startChannel} (${channels})`);
        }
      }

      lines.push('', 'Groups:');

      if (groupNames.length === 0) {
        lines.push('  No groups defined');
      } else {
        for (const name of groupNames) {
          const group = fixtureStore.getGroup(name);
          const fixtureNames = group.map((f) => f.name).join(', ');
          lines.push(`  ${name} - ${group.length} fixtures: ${fixtureNames}`);
        }
      }

      lines.push('', 'Available colors:');
      lines.push(`  ${Object.keys(NAMED_COLORS).join(', ')}`);

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to load fixtures: ${err}` }],
        isError: true,
      };
    }
  }
);

// Tool: setFixtureColor
server.tool(
  'setFixtureColor',
  'Set a fixture to a named color or RGB value',
  {
    fixture: z.string().describe('Fixture name'),
    color: z.string().describe(`Color name (${Object.keys(NAMED_COLORS).join(', ')}) or "rgb(r,g,b)"`),
  },
  async ({ fixture, color }) => {
    const controller = await getController();

    // Parse rgb(r,g,b) format
    const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    const colorInput = rgbMatch
      ? { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) }
      : color;

    const result = controller.setFixtureColor(fixture, colorInput);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: setGroupColor
server.tool(
  'setGroupColor',
  'Set all fixtures in a group to a named color or RGB value',
  {
    group: z.string().describe('Group name'),
    color: z.string().describe(`Color name (${Object.keys(NAMED_COLORS).join(', ')}) or "rgb(r,g,b)"`),
  },
  async ({ group, color }) => {
    const controller = await getController();

    // Parse rgb(r,g,b) format
    const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    const colorInput = rgbMatch
      ? { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) }
      : color;

    const result = controller.setGroupColor(group, colorInput);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: turnOffFixture
server.tool(
  'turnOffFixture',
  'Turn off a fixture (set all channels to 0)',
  {
    fixture: z.string().describe('Fixture name'),
  },
  async ({ fixture }) => {
    const controller = await getController();
    const result = controller.turnOffFixture(fixture);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Tool: turnOffGroup
server.tool(
  'turnOffGroup',
  'Turn off all fixtures in a group',
  {
    group: z.string().describe('Group name'),
  },
  async ({ group }) => {
    const controller = await getController();
    const result = controller.turnOffGroup(group);
    return {
      content: [{ type: 'text', text: result.message }],
      isError: !result.success,
    };
  }
);

// Handle shutdown
process.on('SIGINT', async () => {
  await shutdownController();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownController();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
