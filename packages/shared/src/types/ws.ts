import type {
  AttributeBundle,
  FixtureId,
  GraphId,
} from './domain.js';
import type { CompileError } from './api.js';

// ============================================
// Client -> Server Messages
// ============================================

export interface InputFaderMessage {
  type: 'input/fader';
  faderId: string;
  value: number; // 0..1
}

export interface InputButtonDownMessage {
  type: 'input/buttonDown';
  buttonId: string;
}

export interface InputButtonUpMessage {
  type: 'input/buttonUp';
  buttonId: string;
}

export interface InputButtonPressMessage {
  type: 'input/buttonPress';
  buttonId: string;
}

export interface SubscribeFramesMessage {
  type: 'runtime/subscribeFrames';
  mode: 'full' | 'delta';
  fixtureIds?: FixtureId[]; // If omitted, subscribe to all
}

export interface UnsubscribeFramesMessage {
  type: 'runtime/unsubscribeFrames';
}

export interface SetTickRateMessage {
  type: 'runtime/setTickRate';
  hz: number;
}

export interface SetInstanceEnabledMessage {
  type: 'instance/setEnabled';
  instanceId: string;
  enabled: boolean;
}

// Union of all client messages
export type ClientMessage =
  | InputFaderMessage
  | InputButtonDownMessage
  | InputButtonUpMessage
  | InputButtonPressMessage
  | SubscribeFramesMessage
  | UnsubscribeFramesMessage
  | SetTickRateMessage
  | SetInstanceEnabledMessage;

// ============================================
// Server -> Client Messages
// ============================================

export interface InstanceStatus {
  id: string;
  graphId: GraphId;
  enabled: boolean;
  lastError?: string;
  errorCount?: number;
}

export interface RuntimeStatusMessage {
  type: 'runtime/status';
  tickHz: number;
  t: number; // Current time in seconds
  instances: InstanceStatus[];
}

export interface CompileResultMessage {
  type: 'compile/result';
  graphId: GraphId;
  ok: boolean;
  errors: CompileError[];
}

export interface FrameFullMessage {
  type: 'frame/full';
  t?: number;
  frameNumber: number;
  fixtures: Record<FixtureId, Partial<AttributeBundle>>;
}

export interface FrameDeltaMessage {
  type: 'frame/delta';
  t?: number;
  frameNumber: number;
  changes: Record<FixtureId, Partial<AttributeBundle> | null>;
}

// Error message (for invalid client messages)
export interface ErrorMessage {
  type: 'error';
  message: string;
  code: string;
}

// Show changed notification (broadcast to all clients)
export interface ShowChangedMessage {
  type: 'show/changed';
  show: string;
}

// Union of all server messages
export type ServerMessage =
  | RuntimeStatusMessage
  | CompileResultMessage
  | FrameFullMessage
  | FrameDeltaMessage
  | ErrorMessage
  | ShowChangedMessage;
