import type { FastifyPluginAsync } from 'fastify';
import type {
  ClientMessage,
  ServerMessage,
  RuntimeStatusMessage,
  FrameFullMessage,
  FrameDeltaMessage,
  InstanceStatus,
  ShowChangedMessage,
} from '@let-there-be-light/shared';
import { getEngine, type FrameOutput } from '../runtime/index.js';
import type { WebSocket as WsWebSocket } from 'ws';

// WebSocket readyState constants (ws library uses same values as browser WebSocket)
const WS_OPEN = 1;

// Track connected clients
const clients = new Set<WsWebSocket>();

// Track frame subscriptions per client
interface FrameSubscription {
  mode: 'full' | 'delta';
  fixtureIds?: string[];
}
const subscriptions = new Map<WsWebSocket, FrameSubscription>();

// Last frame sent to each client (for delta mode)
const lastFrameByClient = new Map<WsWebSocket, FrameOutput>();

// Unsubscribe function for engine listener
let unsubscribeEngine: (() => void) | null = null;

// Broadcast message to all connected clients
function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WS_OPEN) {
      try {
        client.send(data);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    }
  }
}

// Send runtime status to a client
function sendStatus(socket: WsWebSocket) {
  if (socket.readyState !== WS_OPEN) return;

  try {
    const engine = getEngine();
    const stats = engine.getStats();

    const instances: InstanceStatus[] = engine.getLoadedGraphIds().map((id) => ({
      id,
      graphId: id,
      enabled: true, // TODO: get actual enabled state
      errorCount: 0,
    }));

    const status: RuntimeStatusMessage = {
      type: 'runtime/status',
      tickHz: stats.targetHz,
      t: stats.frameNumber / stats.targetHz,
      instances,
    };
    socket.send(JSON.stringify(status));
  } catch (err) {
    console.error('Error sending status:', err);
  }
}

// Handle frame from engine
function onEngineFrame(frame: FrameOutput) {
  for (const [socket, sub] of subscriptions) {
    if (socket.readyState !== WS_OPEN) {
      subscriptions.delete(socket);
      lastFrameByClient.delete(socket);
      continue;
    }

    // Filter fixtures if subscription specifies
    let fixtureData = frame.fixtures;
    if (sub.fixtureIds && sub.fixtureIds.length > 0) {
      fixtureData = {};
      for (const id of sub.fixtureIds) {
        if (frame.fixtures[id]) {
          fixtureData[id] = frame.fixtures[id];
        }
      }
    }

    try {
      if (sub.mode === 'full') {
        // Send full frame
        const msg: FrameFullMessage = {
          type: 'frame/full',
          frameNumber: frame.frameNumber,
          fixtures: fixtureData,
        };
        socket.send(JSON.stringify(msg));
      } else {
        // Delta mode - only send changes
        const lastFrame = lastFrameByClient.get(socket);
        const delta: Record<string, Partial<import('@let-there-be-light/shared').AttributeBundle> | null> = {};
        let hasChanges = false;

        for (const [id, attrs] of Object.entries(fixtureData)) {
          const lastAttrs = lastFrame?.fixtures[id];
          if (!lastAttrs || JSON.stringify(attrs) !== JSON.stringify(lastAttrs)) {
            delta[id] = attrs;
            hasChanges = true;
          }
        }

        // Also check for removed fixtures
        if (lastFrame) {
          for (const id of Object.keys(lastFrame.fixtures)) {
            if (!(id in fixtureData)) {
              delta[id] = null;
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          const msg: FrameDeltaMessage = {
            type: 'frame/delta',
            frameNumber: frame.frameNumber,
            changes: delta,
          };
          socket.send(JSON.stringify(msg));
        }
      }
    } catch (err) {
      console.error('Error sending frame to client:', err);
      subscriptions.delete(socket);
      lastFrameByClient.delete(socket);
    }

    // Update last frame for this client
    lastFrameByClient.set(socket, {
      ...frame,
      fixtures: { ...fixtureData },
    });
  }
}

export const wsGateway: FastifyPluginAsync = async (app) => {
  // Subscribe to engine frames when first client connects
  const engine = getEngine();

  app.get('/', { websocket: true }, (socket, req) => {
    // Add to clients set
    const ws = socket as unknown as WsWebSocket;
    clients.add(ws);
    console.log(`WebSocket client connected. Total: ${clients.size}`);

    // Subscribe to engine if this is the first client
    if (!unsubscribeEngine && subscriptions.size === 0) {
      unsubscribeEngine = engine.onFrame(onEngineFrame);
    }

    // Send initial status
    sendStatus(ws);

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        handleMessage(ws, message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          code: 'PARSE_ERROR',
        }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      clients.delete(ws);
      subscriptions.delete(ws);
      lastFrameByClient.delete(ws);
      console.log(`WebSocket client disconnected. Total: ${clients.size}`);

      // Unsubscribe from engine if no more clients
      if (clients.size === 0 && unsubscribeEngine) {
        unsubscribeEngine();
        unsubscribeEngine = null;
      }
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
      subscriptions.delete(ws);
      lastFrameByClient.delete(ws);
    });
  });
};

// Handle incoming client messages
function handleMessage(socket: WsWebSocket, message: ClientMessage) {
  const engine = getEngine();

  switch (message.type) {
    case 'input/fader':
      engine.setFader(message.faderId, message.value);
      break;

    case 'input/buttonDown':
      engine.setButtonDown(message.buttonId, true);
      break;

    case 'input/buttonUp':
      engine.setButtonDown(message.buttonId, false);
      break;

    case 'input/buttonPress':
      // Simulate press and release in same frame
      engine.setButtonDown(message.buttonId, true);
      // Button will be released by endFrame() in engine
      break;

    case 'runtime/subscribeFrames':
      subscriptions.set(socket, {
        mode: message.mode,
        fixtureIds: message.fixtureIds,
      });
      lastFrameByClient.delete(socket); // Reset delta tracking
      console.log(`Client subscribed to frames: mode=${message.mode}`);
      break;

    case 'runtime/unsubscribeFrames':
      subscriptions.delete(socket);
      lastFrameByClient.delete(socket);
      console.log('Client unsubscribed from frames');
      break;

    case 'runtime/setTickRate':
      // Tick rate is set at engine construction, log but don't change
      console.log(`Tick rate change requested: ${message.hz}Hz (not implemented)`);
      sendStatus(socket);
      break;

    case 'instance/setEnabled':
      engine.setGraphEnabled(message.instanceId, message.enabled);
      console.log(`Instance ${message.instanceId} enabled=${message.enabled}`);
      break;

    default:
      console.warn('Unknown message type:', (message as { type: string }).type);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type',
        code: 'UNKNOWN_TYPE',
      }));
  }
}

/**
 * Broadcast show change notification to all connected clients
 * Clients should invalidate all cached data and refetch
 */
export function broadcastShowChange(show: string): void {
  const message: ShowChangedMessage = {
    type: 'show/changed',
    show,
  };
  broadcast(message);
  console.log(`Broadcast show change to ${clients.size} clients: ${show}`);
}

// Export for use by other modules
export { clients, broadcast };
