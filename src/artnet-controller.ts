/**
 * Art-Net Controller
 *
 * Manages DMX state and continuous Art-Net output.
 * Extracted from interactive-control for reuse by MCP server and CLI tools.
 */

import dgram from 'dgram';
import { config, refreshIntervalMs } from './config.js';
import { createArtDmx, createDmxBuffer, formatUniverse } from './artnet-protocol.js';

export interface UniverseStatus {
  universe: number;
  activeChannels: number;
  firstActive: number | null;
  lastActive: number | null;
  channelValues: number[];
}

export interface ControllerStatus {
  isOutputting: boolean;
  refreshRateHz: number;
  targetAddress: string;
  targetPort: number;
  universes: UniverseStatus[];
}

export class ArtNetController {
  private dmxState = new Map<number, Buffer>();
  private sequenceCounters = new Map<number, number>();
  private socket: dgram.Socket | null = null;
  private outputInterval: NodeJS.Timeout | null = null;
  private _isOutputting = false;

  /**
   * Initialize the controller and bind the UDP socket
   */
  async initialize(): Promise<void> {
    if (this.socket) return;

    this.socket = dgram.createSocket('udp4');

    return new Promise((resolve, reject) => {
      this.socket!.on('error', (err) => {
        reject(err);
      });

      this.socket!.bind(() => {
        this.socket!.setBroadcast(true);
        resolve();
      });
    });
  }

  /**
   * Get or create DMX buffer for a universe
   */
  private getDmxBuffer(universe: number): Buffer {
    if (!this.dmxState.has(universe)) {
      this.dmxState.set(universe, createDmxBuffer());
      this.sequenceCounters.set(universe, 1);
    }
    return this.dmxState.get(universe)!;
  }

  /**
   * Get next sequence number for a universe
   */
  private getNextSequence(universe: number): number {
    const current = this.sequenceCounters.get(universe) || 1;
    const next = current >= 255 ? 1 : current + 1;
    this.sequenceCounters.set(universe, next);
    return current;
  }

  /**
   * Send DMX data for all active universes
   */
  private sendDmxOutput(): void {
    if (!this.socket) return;

    for (const [universe, dmxBuffer] of this.dmxState) {
      const sequence = this.getNextSequence(universe);
      const artDmx = createArtDmx(universe, dmxBuffer, sequence);

      this.socket.send(artDmx, config.artnet.port, config.network.broadcast, () => {
        // Ignore send errors for continuous output
      });
    }
  }

  /**
   * Start continuous Art-Net output
   */
  startOutput(): void {
    if (this._isOutputting) return;

    // Ensure at least universe 0 exists
    this.getDmxBuffer(0);

    this.outputInterval = setInterval(() => this.sendDmxOutput(), refreshIntervalMs);
    this._isOutputting = true;

    // Send immediately
    this.sendDmxOutput();
  }

  /**
   * Stop continuous Art-Net output (sends blackout first)
   */
  stopOutput(): void {
    if (!this._isOutputting) return;

    // Blackout before stopping
    this.blackout();
    this.sendDmxOutput();

    if (this.outputInterval) {
      clearInterval(this.outputInterval);
      this.outputInterval = null;
    }
    this._isOutputting = false;
  }

  /**
   * Set a single channel value
   */
  setChannel(universe: number, channel: number, value: number): { success: boolean; message: string } {
    if (channel < 1 || channel > 512) {
      return { success: false, message: 'Channel must be 1-512' };
    }
    if (value < 0 || value > 255) {
      return { success: false, message: 'Value must be 0-255' };
    }

    const dmxBuffer = this.getDmxBuffer(universe);
    dmxBuffer[channel - 1] = value;

    const percentage = Math.round((value / 255) * 100);
    return {
      success: true,
      message: `Set universe ${formatUniverse(universe)} channel ${channel} to ${value} (${percentage}%)`,
    };
  }

  /**
   * Set all channels in a universe to the same value
   */
  setAll(universe: number, value: number): { success: boolean; message: string } {
    if (value < 0 || value > 255) {
      return { success: false, message: 'Value must be 0-255' };
    }

    const dmxBuffer = this.getDmxBuffer(universe);
    dmxBuffer.fill(value);

    const percentage = Math.round((value / 255) * 100);
    return {
      success: true,
      message: `Set all 512 channels in universe ${formatUniverse(universe)} to ${value} (${percentage}%)`,
    };
  }

  /**
   * Blackout specified universes or all active universes
   */
  blackout(universes?: number[]): { success: boolean; message: string } {
    if (universes && universes.length > 0) {
      // Blackout specific universes
      for (const universe of universes) {
        const dmxBuffer = this.getDmxBuffer(universe);
        dmxBuffer.fill(0);
      }
      return {
        success: true,
        message: `Blackout on universe(s): ${universes.join(', ')}`,
      };
    } else {
      // Blackout all active universes
      for (const [, dmxBuffer] of this.dmxState) {
        dmxBuffer.fill(0);
      }
      // Ensure universe 0 exists
      this.getDmxBuffer(0).fill(0);

      return {
        success: true,
        message: 'Blackout - all channels set to 0',
      };
    }
  }

  /**
   * Get current status
   */
  getStatus(universe?: number): ControllerStatus {
    const universes: UniverseStatus[] = [];

    const universesToCheck = universe !== undefined
      ? [universe]
      : Array.from(this.dmxState.keys());

    for (const u of universesToCheck) {
      const dmxBuffer = this.dmxState.get(u);
      if (!dmxBuffer && universe === undefined) continue;

      const buffer = dmxBuffer || createDmxBuffer();
      let activeChannels = 0;
      let firstActive: number | null = null;
      let lastActive: number | null = null;

      for (let i = 0; i < 512; i++) {
        if (buffer[i] !== 0) {
          activeChannels++;
          if (firstActive === null) firstActive = i + 1;
          lastActive = i + 1;
        }
      }

      universes.push({
        universe: u,
        activeChannels,
        firstActive,
        lastActive,
        channelValues: Array.from(buffer),
      });
    }

    return {
      isOutputting: this._isOutputting,
      refreshRateHz: config.artnet.refreshRateHz,
      targetAddress: config.network.broadcast,
      targetPort: config.artnet.port,
      universes,
    };
  }

  /**
   * Check if output is currently active
   */
  get isOutputting(): boolean {
    return this._isOutputting;
  }

  /**
   * Cleanup and close socket
   */
  async shutdown(): Promise<void> {
    this.stopOutput();

    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.close(() => {
          this.socket = null;
          resolve();
        });
      });
    }
  }
}

// Singleton instance for MCP server
let controllerInstance: ArtNetController | null = null;

export async function getController(): Promise<ArtNetController> {
  if (!controllerInstance) {
    controllerInstance = new ArtNetController();
    await controllerInstance.initialize();
  }
  return controllerInstance;
}

export async function shutdownController(): Promise<void> {
  if (controllerInstance) {
    await controllerInstance.shutdown();
    controllerInstance = null;
  }
}
