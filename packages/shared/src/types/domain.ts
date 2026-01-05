// Core identifiers
export type FixtureId = string;
export type GroupId = string;
export type GraphId = string;
export type NodeId = string;
export type EdgeId = string;
export type InputId = string;

// Base entity with revision for optimistic concurrency
export interface Entity {
  id: string;
  revision: number;
}

// Fixture Model (reusable template defining channel layout)
export interface FixtureModel {
  id: string;
  brand: string;
  model: string;
  channels: Record<string, number>; // channelName -> relative offset (1-based)
}

// Fixture (patched instance at a specific DMX address)
export interface Fixture extends Entity {
  name: string;
  modelId: string;
  universe: number;
  startChannel: number;
}

// Group (collection of fixtures)
export interface Group extends Entity {
  name: string;
  fixtureIds: FixtureId[];
}

// RGB Color (each channel 0..1)
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Position (pan/tilt, -1..1)
export interface Position {
  pan: number;
  tilt: number;
}

// AttributeBundle (normalized fixture state)
// All values are normalized: intensity/zoom 0..1, color 0..1, pan/tilt -1..1
export interface AttributeBundle {
  intensity?: number;
  color?: RGBColor;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

// Graph node position in editor
export interface NodePosition {
  x: number;
  y: number;
}

// Graph node
export interface GraphNode {
  id: NodeId;
  type: string; // NodeType from nodes.ts
  position: NodePosition;
  params: Record<string, unknown>;
}

// Graph edge (connection between nodes)
export interface GraphEdge {
  id: EdgeId;
  from: {
    nodeId: NodeId;
    port: string;
  };
  to: {
    nodeId: NodeId;
    port: string;
  };
}

// Graph (node-based effect/control flow)
export interface Graph extends Entity {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  enabled?: boolean;
}

// Input type discriminator
export type InputType = 'fader' | 'button';

// Input (configurable fader or button)
export interface Input extends Entity {
  type: InputType;
  name: string;
}

// Runtime input state (faders and buttons)
export interface InputState {
  faders: Record<string, number>; // faderId -> value (0..1)
  buttonsDown: Record<string, boolean>; // buttonId -> isDown
  buttonPressedQueue: Array<{ buttonId: string; t: number }>; // edge triggers
}

// Frame output (per-fixture attribute values)
export interface Frame {
  t: number; // timestamp
  fixtures: Record<FixtureId, AttributeBundle>;
}

// Frame delta (only changed values)
export interface FrameDelta {
  t: number;
  changes: Record<FixtureId, Partial<AttributeBundle>>;
}
