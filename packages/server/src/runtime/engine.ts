import type { Graph, GraphNode, AttributeBundle, NodeId, NodeType, WriteOutputInfo } from '@let-there-be-light/shared';
import { InputState } from './input-state.js';
import { NODE_EVALUATORS, getWriteOutput, type RuntimeValue, type EvaluatorContext } from './evaluators/index.js';
import { compileGraph, getCompiledGraph, type CompiledGraph } from '../graph/index.js';
import { getStores } from '../datastore/index.js';
import { buildReverseAdjacencyList, getEdgesToPort } from '../graph/topology.js';

/**
 * Frame output - attributes per fixture
 */
export interface FrameOutput {
  /** Frame number since engine start */
  frameNumber: number;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Attributes per fixture ID */
  fixtures: Record<string, Partial<AttributeBundle>>;
}

/**
 * Graph instance - a compiled graph ready for evaluation
 */
interface GraphInstance {
  graph: Graph;
  compiled: CompiledGraph;
  enabled: boolean;
  nodeState: Map<string, unknown>;
}

/**
 * Frame listener callback
 */
export type FrameListener = (frame: FrameOutput) => void;

/**
 * RuntimeEngine - 60Hz tick loop for graph evaluation
 */
export class RuntimeEngine {
  private instances = new Map<string, GraphInstance>();
  private inputs = new InputState();
  private listeners: FrameListener[] = [];
  private writeOutputs = new Map<string, WriteOutputInfo[]>();

  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private frameNumber = 0;
  private lastTickTime = 0;

  private targetHz: number;
  private tickMs: number;

  constructor(hz = 60) {
    this.targetHz = hz;
    this.tickMs = 1000 / hz;
  }

  /**
   * Start the tick loop
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.startTime = performance.now();
    this.lastTickTime = this.startTime;
    this.frameNumber = 0;

    // Use setInterval for consistent timing
    this.tickInterval = setInterval(() => this.tick(), this.tickMs);

    console.log(`RuntimeEngine started at ${this.targetHz}Hz`);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    console.log('RuntimeEngine stopped');
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Set a fader value
   */
  setFader(faderId: string, value: number): void {
    this.inputs.setFader(faderId, value);
  }

  /**
   * Set button down state
   */
  setButtonDown(buttonId: string, down: boolean): void {
    this.inputs.setButtonDown(buttonId, down);
  }

  /**
   * Load and compile a graph, creating an instance
   */
  loadGraph(graphId: string): boolean {
    const { graphs } = getStores();
    const graph = graphs.getById(graphId);

    if (!graph) {
      console.error(`Graph not found: ${graphId}`);
      return false;
    }

    const compiled = getCompiledGraph(graph);
    if (!compiled) {
      console.error(`Failed to compile graph: ${graphId}`);
      return false;
    }

    this.instances.set(graphId, {
      graph,
      compiled,
      enabled: graph.enabled ?? true,
      nodeState: new Map(),
    });

    return true;
  }

  /**
   * Unload a graph instance
   */
  unloadGraph(graphId: string): void {
    this.instances.delete(graphId);
    this.writeOutputs.delete(graphId);
  }

  /**
   * Enable/disable a graph instance
   */
  setGraphEnabled(graphId: string, enabled: boolean): void {
    const instance = this.instances.get(graphId);
    if (instance) {
      instance.enabled = enabled;
    }
  }

  /**
   * Get all loaded graph IDs
   */
  getLoadedGraphIds(): string[] {
    return [...this.instances.keys()];
  }

  /**
   * Unload all graph instances (for show switching)
   */
  unloadAllGraphs(): void {
    this.instances.clear();
    this.writeOutputs.clear();
    console.log('All graphs unloaded');
  }

  /**
   * Reload all graphs from datastore
   */
  reloadAllGraphs(): void {
    const { graphs } = getStores();
    const allGraphs = graphs.getAll();

    // Clear existing instances
    this.instances.clear();

    // Load all graphs
    for (const graph of allGraphs) {
      this.loadGraph(graph.id);
    }

    console.log(`Loaded ${this.instances.size} graphs`);
  }

  /**
   * Subscribe to frame output
   */
  onFrame(listener: FrameListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Main tick function - called at target Hz
   */
  private tick(): void {
    const now = performance.now();
    const time = (now - this.startTime) / 1000;
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    this.frameNumber++;

    // Collect all write outputs
    const writes: Array<{
      nodeId: string;
      selection: Set<string>;
      bundle: Partial<AttributeBundle>;
      priority: number;
    }> = [];

    // Evaluate each graph
    for (const instance of this.instances.values()) {
      if (!instance.enabled) {
        // Clear write outputs for disabled graphs
        this.writeOutputs.set(instance.graph.id, []);
        continue;
      }

      const instanceWrites = this.evaluateGraph(instance, time, deltaTime);
      writes.push(...instanceWrites);
    }

    // Clear per-frame input state
    this.inputs.endFrame();

    // Merge writes by priority (higher priority wins)
    const fixtureOutputs = this.mergeWrites(writes);

    // Build frame output
    const frame: FrameOutput = {
      frameNumber: this.frameNumber,
      timestamp: now,
      fixtures: fixtureOutputs,
    };

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(frame);
      } catch (err) {
        console.error('Frame listener error:', err);
      }
    }
  }

  /**
   * Evaluate a single graph instance
   */
  private evaluateGraph(
    instance: GraphInstance,
    time: number,
    deltaTime: number
  ): Array<{
    nodeId: string;
    selection: Set<string>;
    bundle: Partial<AttributeBundle>;
    priority: number;
  }> {
    const { graph, compiled, nodeState } = instance;
    const outputs = new Map<string, Record<string, RuntimeValue>>();

    // Build edge lookup for input resolution
    const reverseAdj = buildReverseAdjacencyList(graph.nodes, graph.edges);

    // Create evaluator context
    const ctx: EvaluatorContext = {
      time,
      deltaTime,
      inputs: this.inputs,

      getInput: (nodeId: string, port: string): RuntimeValue | null => {
        // Find edge(s) connecting to this port
        const edges = getEdgesToPort(graph.edges, nodeId, port);
        if (edges.length === 0) return null;

        // Get the first edge's source
        const edge = edges[0];
        const sourceOutputs = outputs.get(edge.from.nodeId);
        if (!sourceOutputs) return null;

        return sourceOutputs[edge.from.port] ?? null;
      },

      getNodeState: <T>(nodeId: string): T | undefined => {
        return nodeState.get(nodeId) as T | undefined;
      },

      setNodeState: <T>(nodeId: string, state: T): void => {
        nodeState.set(nodeId, state);
      },
    };

    // Evaluate nodes in topological order
    for (const nodeId of compiled.evaluationOrder) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const evaluator = NODE_EVALUATORS[node.type as NodeType];
      if (!evaluator) {
        console.warn(`No evaluator for node type: ${node.type}`);
        continue;
      }

      try {
        const nodeOutputs = evaluator(node, ctx);
        outputs.set(nodeId, nodeOutputs);
      } catch (err) {
        console.error(`Error evaluating node ${nodeId}:`, err);
      }
    }

    // Collect WriteAttributes outputs
    const writes: Array<{
      nodeId: string;
      selection: Set<string>;
      bundle: Partial<AttributeBundle>;
      priority: number;
    }> = [];

    for (const node of graph.nodes) {
      if (node.type === 'WriteAttributes') {
        const writeOutput = getWriteOutput(node, ctx);
        if (writeOutput.selection.size > 0) {
          writes.push({
            nodeId: node.id,
            ...writeOutput,
          });
        }
      }
    }

    // Store write outputs for status reporting
    this.writeOutputs.set(graph.id, writes.map((w) => ({
      nodeId: w.nodeId,
      selection: [...w.selection],
      bundle: w.bundle,
      priority: w.priority,
    })));

    return writes;
  }

  /**
   * Merge write outputs by priority
   */
  private mergeWrites(
    writes: Array<{
      nodeId: string;
      selection: Set<string>;
      bundle: Partial<AttributeBundle>;
      priority: number;
    }>
  ): Record<string, Partial<AttributeBundle>> {
    // Sort by priority (ascending, so higher priority processes last and wins)
    writes.sort((a, b) => a.priority - b.priority);

    const result: Record<string, Partial<AttributeBundle>> = {};

    for (const write of writes) {
      for (const fixtureId of write.selection) {
        if (!result[fixtureId]) {
          result[fixtureId] = {};
        }

        // Merge bundle into fixture output
        const current = result[fixtureId];
        const incoming = write.bundle;

        if (incoming.intensity !== undefined) {
          current.intensity = incoming.intensity;
        }
        if (incoming.color !== undefined) {
          current.color = { ...current.color, ...incoming.color };
        }
        if (incoming.pan !== undefined) {
          current.pan = incoming.pan;
        }
        if (incoming.tilt !== undefined) {
          current.tilt = incoming.tilt;
        }
        if (incoming.zoom !== undefined) {
          current.zoom = incoming.zoom;
        }
      }
    }

    return result;
  }

  /**
   * Get current runtime stats
   */
  getStats(): {
    running: boolean;
    frameNumber: number;
    targetHz: number;
    loadedGraphs: number;
    enabledGraphs: number;
  } {
    let enabledCount = 0;
    for (const instance of this.instances.values()) {
      if (instance.enabled) enabledCount++;
    }

    return {
      running: this.running,
      frameNumber: this.frameNumber,
      targetHz: this.targetHz,
      loadedGraphs: this.instances.size,
      enabledGraphs: enabledCount,
    };
  }

  /**
   * Get WriteAttributes outputs for a graph
   */
  getWriteOutputs(graphId: string): WriteOutputInfo[] {
    return this.writeOutputs.get(graphId) ?? [];
  }

  /**
   * Check if a graph instance is enabled
   */
  isGraphEnabled(graphId: string): boolean {
    const instance = this.instances.get(graphId);
    return instance?.enabled ?? false;
  }
}

// Singleton instance
let engine: RuntimeEngine | null = null;

/**
 * Get the singleton RuntimeEngine instance
 */
export function getEngine(): RuntimeEngine {
  if (!engine) {
    engine = new RuntimeEngine();
  }
  return engine;
}
