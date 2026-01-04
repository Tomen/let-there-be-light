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
import { getController, shutdownController } from './artnet-controller.js';

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
