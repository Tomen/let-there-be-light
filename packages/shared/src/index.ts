// Domain types
export type {
  FixtureId,
  GroupId,
  GraphId,
  NodeId,
  EdgeId,
  InputId,
  Entity,
  FixtureModel,
  Fixture,
  Group,
  RGBColor,
  Position,
  AttributeBundle,
  NodePosition,
  GraphNode,
  GraphEdge,
  Graph,
  InputType,
  Input,
  InputState,
  Frame,
  FrameDelta,
} from './types/domain.js';

// API types
export type {
  ApiResponse,
  ApiError,
  ApiErrorCode,
  CompileErrorCode,
  CompileError,
  GraphDependencies,
  CompileResult,
  ListResponse,
  CreateRequest,
  UpdateRequest,
} from './types/api.js';

// WebSocket types
export type {
  InputFaderMessage,
  InputButtonDownMessage,
  InputButtonUpMessage,
  InputButtonPressMessage,
  SubscribeFramesMessage,
  UnsubscribeFramesMessage,
  SetTickRateMessage,
  SetInstanceEnabledMessage,
  ClientMessage,
  InstanceStatus,
  RuntimeStatusMessage,
  CompileResultMessage,
  FrameFullMessage,
  FrameDeltaMessage,
  ErrorMessage,
  ShowChangedMessage,
  ServerMessage,
} from './types/ws.js';

// Show types
export type { Show, CurrentShow } from './types/shows.js';

// Node types
export type {
  PortType,
  ParamType,
  ParamDefinition,
  PortDefinition,
  NodeType,
  NodeDefinition,
} from './types/nodes.js';

export {
  NODE_DEFINITIONS,
  CONNECTABLE_PORT_TYPES,
  getNodeDefinition,
  getNodesByCategory,
  getCategories,
  isConnectableType,
  hasDefault,
} from './types/nodes.js';
