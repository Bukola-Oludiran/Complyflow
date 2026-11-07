/**
 * Scheduler — message queue, microtask batching, and processing loop.
 *
 * Inspired by Preact's enqueueRender/process pattern (src/component.js:185-255).
 * Adapted for message-passing on a graph instead of DOM diffing.
 */

import type { Message, EmitOptions, IncomingMessage, NodeDefinition, TopologyEvent, TopologyHandler, TopologyFilterOptions } from '../types.js';
import type { CommunicationGraph } from '../graph/graph.js';
import type { GraphReactEdgeAttributes } from '../graph/attributes.js';
import { NodeInstance } from './node-instance.js';
import { NODE_DIRTY, NODE_UNMOUNTED, MAX_PROCESS_DEPTH, DEFAULT_TTL } from './constants.js';
import { createMessage, decrementTTL } from './message.js';
import { setEnqueueNodeUpdate, setEmitCallback, setNeighborsCallback, setGraphQueryCallback, setSourceCallbacks } from './hooks.js';
import type { EventSource } from './sources.js';
import { nodeAccepts, resolveChannelPolicy } from './permissions.js';
import { evaluateNode, evaluateNodeAsync, unmountNode, unmountNodeAsync } from './lifecycle.js';
import type { EvalOptions } from './lifecycle.js';
import { GraphDirectory, buildDirectory } from './directory.js';
import { CommunicationGraph as CommunicationGraphType } from '../graph/graph.js';

export class Scheduler {
  /** The communication graph */
  graph: CommunicationGraph;

  /** Node ID → NodeInstance */
  nodes: Map<string, NodeInstance>;

  /** Message queue */
  private messageQueue: Message[];

  /** Nodes that need re-evaluation */
  private dirtyQueue: Set<NodeInstance>;

  /** Whether a microtask flush is already scheduled */
  private scheduled: boolean;

  /** Whether the runtime is running */
  private running: boolean;

  /** Callback for testing: called on each message delivery */
  onMessageDelivered?: (msg: Message) => void;

  /** Callback for testing: called when a message is dropped */
  onMessageDropped?: (msg: Message, reason: string) => void;

  /** TTL of the message currently being delivered (for inheritance by emit) */
  private _currentDeliveryTTL: number | null;

  /** Whether async processing is active (suppresses sync scheduleFlush) */
  private _asyncProcessing: boolean;

  /** Active event sources across all nodes */
  private _sources: Map<string, EventSource>;

  /** Daemon promise — resolves when stopDaemon() is called */
  private _daemonResolve: (() => void) | null;

  /** Graph directory — structural summary for node discovery */
  private _directory: GraphDirectory;

  constructor(graph: CommunicationGraph) {
    this.graph = graph;
    this.nodes = new Map();
    this.messageQueue = [];
    this.dirtyQueue = new Set();
    this.scheduled = false;
    this.running = false;
    this._currentDeliveryTTL = null;
    this._asyncProcessing = false;
    this._sources = new Map();
    this._daemonResolve = null;
    this._directory = new GraphDirectory();

    // Wire up hook callbacks
    setEnqueueNodeUpdate((node: NodeInstance) => {
      this.enqueueProcess(node);
    });

    setEmitCallback((from: string, type: string, payload: unknown, opts?: EmitOptions) => {
      this.handleEmit(from, type, payload, opts);
    });

    setNeighborsCallback((nodeId: string) => {
      return this.graph.neighbors(nodeId);
    });

    setGraphQueryCallback((queryFn: (graph: CommunicationGraph) => unknown) => {
      return queryFn(this.graph);
    });

    setSourceCallbacks(
      (nodeId: string, source: EventSource) => {
        this.registerSource(nodeId, source);
      },
      (sourceId: string) => {
        this.unregisterSource(sourceId);
      }
    );

    // Subscribe to graph topology events and dispatch to useTopology handlers
    this.graph.onTopologyChange((event: TopologyEvent) => {
      this._dispatchTopologyEvent(event);
    });
  }

  /** Register a node instance */
  registerNode(node: NodeInstance): void {
    this.nodes.set(node.id, node);
  }

  /** Unregister a node instance */
  unregisterNode(id: string): void {
    this.nodes.delete(id);
  }

  // ---- Dynamic graph mutation ----

  /**
   * Add a node to the running graph. Creates the node in the graph engine,
   * instantiates it, connects edges, and evaluates it if the scheduler is running.
   */
  addNodeAtRuntime(
    id: string,
    definition: NodeDefinition,
    props: Record<string, unknown> = {},
    connectTo: string[] = []
  ): void {
    this.graph.addNode(id, { component: definition.name, ...props });
    const instance = new NodeInstance(definition, id, props);
    this.registerNode(instance);
    for (const target of connectTo) {
      this.graph.addEdge(id, target);
    }
    // Add to directory
    this._directory.addEntry({
      id,
      role: definition.name,
      depth: 0, // dynamic nodes default to depth 0 unless specified
      path: [id],
    });
    if (this.running) {
      this.evaluateNode(instance);
      this.processBatch(); // process any messages emitted during mount
    }
  }

  /**
   * Remove a node from the running graph. Unmounts the node, removes it
   * from the graph engine, and unregisters the instance.
   */
  removeNodeAtRuntime(id: string): void {
    const instance = this.nodes.get(id);
    if (instance) {
      unmountNode(instance);
      this.unregisterNode(id);
    }
    if (this.graph.hasNode(id)) {
      this.graph.removeNode(id);
    }
    this._directory.removeEntry(id);
  }

  // ---- Topology dispatch ----

  /**
   * Dispatch a topology event to all nodes that registered useTopology handlers.
   * Applies per-handler filtering (event type and neighbor proximity).
   */
  private _dispatchTopologyEvent(event: TopologyEvent): void {
    for (const [nodeId, instance] of this.nodes) {
      if (instance.__hooks._topologyHandlers.length === 0) continue;
      if (instance.hasFlag(NODE_UNMOUNTED)) continue;

      for (const { handler, options } of instance.__hooks._topologyHandlers) {
        // Filter by event type
        if (options?.types && !options.types.includes(event.type)) continue;

        // Filter by neighbor proximity
        if (options?.neighbors) {
          const involvedNodes = this._getInvolvedNodes(event);
          let nodeNeighbors: string[];
          try {
            nodeNeighbors = this.graph.neighbors(nodeId);
          } catch {
            continue; // Node may have been removed
          }
          const neighborSet = new Set(nodeNeighbors);
          const relevant = involvedNodes.some(n => n === nodeId || neighborSet.has(n));
          if (!relevant) continue;
        }

        handler(event);
      }
    }
  }

  /** Extract node IDs involved in a topology event */
  private _getInvolvedNodes(event: TopologyEvent): string[] {
    switch (event.type) {
      case 'node-added':
      case 'node-removed':
        return [event.nodeId];
      case 'edge-added':
      case 'edge-removed':
      case 'edge-updated':
        return [event.u, event.v];
    }
  }

  // ---- Emit handling ----

  private handleEmit(from: string, type: string, payload: unknown, opts?: EmitOptions): void {
    const sourceNode = this.nodes.get(from);
    if (!sourceNode) return;

    // Direct messaging — bypass edge checks entirely (like a DM)
    if (opts?.direct) {
      const ttl = opts.ttl ?? DEFAULT_TTL;
      const msg = createMessage(type, from, opts.direct, payload, ttl);
      (msg as any)._direct = true; // flag to bypass edge filter in deliverMessage
      this.enqueueMessage(msg);
      return;
    }

    // Inherit TTL from the message being delivered (if inside a handler),
    // otherwise use edge TTL or default. This ensures TTL depletes across hops.
    const inheritedTTL = this._currentDeliveryTTL;

    if (opts?.to) {
      // Targeted emit
      const targets = Array.isArray(opts.to) ? opts.to : [opts.to];
      for (const target of targets) {
        if (this.graph.hasEdge(from, target)) {
          const ttl = opts.ttl ?? inheritedTTL ?? this.getEdgeTTL(from, target, opts.edgeKey) ?? DEFAULT_TTL;
          this.enqueueMessage(createMessage(type, from, target, payload, ttl));
        }
      }
    } else {
      // Broadcast to all neighbors
      for (const neighbor of this.graph.neighbors(from)) {
        const ttl = opts?.ttl ?? inheritedTTL ?? this.getEdgeTTL(from, neighbor) ?? DEFAULT_TTL;
        this.enqueueMessage(createMessage(type, from, neighbor, payload, ttl));
      }
    }
  }

  private getEdgeTTL(u: string, v: string, edgeKey?: string): number | undefined {
    try {
      const data = this.graph.getEdgeData(u, v, edgeKey) as GraphReactEdgeAttributes;
      return data.ttl;
    } catch {
      return undefined;
    }
  }

  // ---- Queue management ----

  enqueueMessage(msg: Message): void {
    this.messageQueue.push(msg);
    this.scheduleFlush();
  }

  enqueueProcess(node: NodeInstance): void {
    node.setFlag(NODE_DIRTY);
    this.dirtyQueue.add(node);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    // Don't schedule sync flush during async processing — async loop handles it
    if (this._asyncProcessing) return;
    if (!this.scheduled && this.running) {
      this.scheduled = true;
      queueMicrotask(() => this.processBatch());
    }
  }

  // ---- Core processing loop ----

  /**
   * Process all pending messages and dirty nodes.
   * Loops until stable or max depth is hit.
   */
  processBatch(): void {
    this.scheduled = false;
    let iterations = 0;

    while (
      (this.messageQueue.length > 0 || this.dirtyQueue.size > 0) &&
      iterations < MAX_PROCESS_DEPTH
    ) {
      iterations++;

      // 1. Process all queued messages
      const messages = this.messageQueue;
      this.messageQueue = [];

      for (const msg of messages) {
        this.deliverMessage(msg);
      }

      // 2. Re-evaluate all dirty nodes
      const dirty = [...this.dirtyQueue];
      this.dirtyQueue.clear();

      for (const node of dirty) {
        if (node.hasFlag(NODE_UNMOUNTED)) continue;
        this.evaluateNode(node);
      }
    }

    if (iterations >= MAX_PROCESS_DEPTH) {
      console.warn(
        `GraphReact: Max processing depth (${MAX_PROCESS_DEPTH}) reached. ` +
        'Possible infinite message loop. Check TTL settings and node logic.'
      );
    }
  }

  /**
   * Process synchronously — for testing without microtasks.
   */
  processSync(): void {
    this.processBatch();
  }

  // ---- Message delivery ----

  private deliverMessage(msg: Message): void {
    // TTL check
    if (msg.ttl <= 0) {
      this.onMessageDropped?.(msg, 'TTL expired');
      return;
    }

    const targetNode = this.nodes.get(msg.to);
    if (!targetNode || targetNode.hasFlag(NODE_UNMOUNTED)) {
      this.onMessageDropped?.(msg, 'Target node not found or unmounted');
      return;
    }

    const isDirect = (msg as any)._direct;
    const isExternal = msg.from === '__external__';

    // Resolve channel policy (merges node-level + edge-level rules)
    if (!isExternal && !isDirect) {
      const policy = resolveChannelPolicy(targetNode, msg.from, this.graph);

      // Permission check via resolved policy
      if (!policy.accepts.includes(msg.type)) {
        this.onMessageDropped?.(msg, `Channel policy rejected '${msg.type}' from '${msg.from}' to '${msg.to}'`);
        return;
      }

      // Apply transform if present
      if (policy.transform) {
        const incoming: IncomingMessage = {
          from: msg.from, type: msg.type, payload: msg.payload, ttl: msg.ttl,
        };
        const transformed = policy.transform(incoming);
        if (transformed === null) {
          this.onMessageDropped?.(msg, `Transform dropped '${msg.type}' on (${msg.from}, ${msg.to})`);
          return;
        }
        // Apply transformed values back to message
        msg.payload = transformed.payload;
        msg.type = transformed.type;
      }
    } else if (isExternal || isDirect) {
      // For external/direct messages: still check flat accepts (no edge policy)
      if (!nodeAccepts(targetNode, msg.type)) {
        this.onMessageDropped?.(msg, `Node '${msg.to}' does not accept '${msg.type}'`);
        return;
      }
    }

    // Decrement TTL before delivery
    if (!decrementTTL(msg)) {
      this.onMessageDropped?.(msg, 'TTL expired after decrement');
      return;
    }

    // Deliver to message handlers
    this._currentDeliveryTTL = msg.ttl;
    const handlers = targetNode.__hooks._messageHandlers.get(msg.type);
    if (handlers) {
      const incoming: IncomingMessage = {
        from: msg.from,
        type: msg.type,
        payload: msg.payload,
        ttl: msg.ttl,
      };
      for (const handler of handlers) {
        handler(incoming);
      }
    }
    this._currentDeliveryTTL = null;

    this.onMessageDelivered?.(msg);
  }


  // ---- Node evaluation (delegates to lifecycle module) ----

  private _makeAcceptEdge(nodeId: string): (targetId: string) => void {
    return (targetId: string) => {
      this.graph.addEdge(nodeId, targetId);
    };
  }

  evaluateNode(node: NodeInstance): void {
    evaluateNode(node, this.graph, {
      directory: this._directory,
      acceptEdgeFn: this._makeAcceptEdge(node.id),
    });
  }

  // ---- Lifecycle ----

  /**
   * Start the runtime: evaluate all registered nodes.
   */
  start(): void {
    this.running = true;
    // Build the graph directory for node discovery
    this._directory = buildDirectory(this.graph, this.nodes);
    // Mount all nodes (initial evaluation)
    for (const node of this.nodes.values()) {
      this.evaluateNode(node);
    }
    // Process any messages generated during mount
    this.processBatch();
  }

  /**
   * Stop the runtime: unmount all nodes, clear queues.
   */
  stop(): void {
    this.running = false;

    for (const node of this.nodes.values()) {
      unmountNode(node);
    }

    this.messageQueue = [];
    this.dirtyQueue.clear();
    this.scheduled = false;
  }

  /**
   * Inject a message from outside the graph.
   */
  send(nodeId: string, type: string, payload: unknown): void {
    const msg = createMessage(type, '__external__', nodeId, payload);
    this.enqueueMessage(msg);
    // Process immediately if running
    if (this.running) {
      this.processBatch();
    }
  }

  // ==== Async / Parallel Processing (Phase 6 — opt-in) ====

  /**
   * Async version of processBatch. Delivers messages (awaiting async handlers),
   * then groups dirty nodes by independence and evaluates independent groups
   * in parallel via Promise.all.
   */
  async processBatchAsync(): Promise<void> {
    this.scheduled = false;
    this._asyncProcessing = true;
    let iterations = 0;

    while (
      (this.messageQueue.length > 0 || this.dirtyQueue.size > 0) &&
      iterations < MAX_PROCESS_DEPTH
    ) {
      iterations++;

      // 1. Process all queued messages (may have async handlers)
      const messages = this.messageQueue;
      this.messageQueue = [];

      for (const msg of messages) {
        await this.deliverMessageAsync(msg);
      }

      // 2. Group dirty nodes by independence for parallel evaluation
      const dirty = [...this.dirtyQueue];
      this.dirtyQueue.clear();

      const active = dirty.filter(n => !n.hasFlag(NODE_UNMOUNTED));
      if (active.length === 0) continue;

      const groups = this.groupIndependentNodes(active);

      // Evaluate independent groups in parallel, sequential within each group
      await Promise.all(
        groups.map(async (group) => {
          for (const node of group) {
            await evaluateNodeAsync(node, this.graph, {
              directory: this._directory,
              acceptEdgeFn: this._makeAcceptEdge(node.id),
            });
          }
        })
      );
    }

    this._asyncProcessing = false;

    if (iterations >= MAX_PROCESS_DEPTH) {
      console.warn(
        `GraphReact: Max processing depth (${MAX_PROCESS_DEPTH}) reached. ` +
        'Possible infinite message loop. Check TTL settings and node logic.'
      );
    }
  }

  /**
   * Async message delivery — awaits async handlers.
   */
  private async deliverMessageAsync(msg: Message): Promise<void> {
    if (msg.ttl <= 0) {
      this.onMessageDropped?.(msg, 'TTL expired');
      return;
    }

    const targetNode = this.nodes.get(msg.to);
    if (!targetNode || targetNode.hasFlag(NODE_UNMOUNTED)) {
      this.onMessageDropped?.(msg, 'Target node not found or unmounted');
      return;
    }

    const isDirect = (msg as any)._direct;
    const isExternal = msg.from === '__external__';

    if (!isExternal && !isDirect) {
      const policy = resolveChannelPolicy(targetNode, msg.from, this.graph);

      if (!policy.accepts.includes(msg.type)) {
        this.onMessageDropped?.(msg, `Channel policy rejected '${msg.type}' from '${msg.from}' to '${msg.to}'`);
        return;
      }

      if (policy.transform) {
        const incoming: IncomingMessage = {
          from: msg.from, type: msg.type, payload: msg.payload, ttl: msg.ttl,
        };
        const transformed = policy.transform(incoming);
        if (transformed === null) {
          this.onMessageDropped?.(msg, `Transform dropped '${msg.type}' on (${msg.from}, ${msg.to})`);
          return;
        }
        msg.payload = transformed.payload;
        msg.type = transformed.type;
      }
    } else {
      if (!nodeAccepts(targetNode, msg.type)) {
        this.onMessageDropped?.(msg, `Node '${msg.to}' does not accept '${msg.type}'`);
        return;
      }
    }

    if (!decrementTTL(msg)) {
      this.onMessageDropped?.(msg, 'TTL expired after decrement');
      return;
    }

    this._currentDeliveryTTL = msg.ttl;
    const handlers = targetNode.__hooks._messageHandlers.get(msg.type);
    if (handlers) {
      const incoming: IncomingMessage = {
        from: msg.from,
        type: msg.type,
        payload: msg.payload,
        ttl: msg.ttl,
      };
      for (const handler of handlers) {
        const result = handler(incoming) as void | Promise<void>;
        if (result instanceof Promise) await result;
      }
    }
    this._currentDeliveryTTL = null;

    this.onMessageDelivered?.(msg);
  }

  /**
   * Group nodes into independent sets based on graph connectivity.
   * Nodes that share no edges can be processed in parallel.
   */
  private groupIndependentNodes(nodes: NodeInstance[]): NodeInstance[][] {
    if (nodes.length <= 1) return [nodes];

    // Build a subgraph of just the dirty node IDs
    const dirtyIds = new Set(nodes.map(n => n.id));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Union-Find to group connected dirty nodes
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };

    // Union dirty nodes that share an edge
    for (const node of nodes) {
      for (const nbr of this.graph.neighbors(node.id)) {
        if (dirtyIds.has(nbr)) {
          union(node.id, nbr);
        }
      }
    }

    // Group by root
    const groups = new Map<string, NodeInstance[]>();
    for (const node of nodes) {
      const root = find(node.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(node);
    }

    return [...groups.values()];
  }

  /**
   * Async version of start — evaluates nodes in parallel where independent.
   */
  async startAsync(): Promise<void> {
    this.running = true;
    this._asyncProcessing = true;
    this._directory = buildDirectory(this.graph, this.nodes);

    const allNodes = [...this.nodes.values()];
    const groups = this.groupIndependentNodes(allNodes);

    await Promise.all(
      groups.map(async (group) => {
        for (const node of group) {
          await evaluateNodeAsync(node, this.graph);
        }
      })
    );

    await this.processBatchAsync();
  }

  /**
   * Async version of stop — awaits async cleanups.
   */
  async stopAsync(): Promise<void> {
    this.running = false;

    await Promise.all(
      [...this.nodes.values()].map(node => unmountNodeAsync(node))
    );

    this.messageQueue = [];
    this.dirtyQueue.clear();
    this.scheduled = false;
  }

  /**
   * Async version of send — injects message and processes asynchronously.
   */
  async sendAsync(nodeId: string, type: string, payload: unknown): Promise<void> {
    const msg = createMessage(type, '__external__', nodeId, payload);
    this.enqueueMessage(msg);
    if (this.running) {
      await this.processBatchAsync();
    }
  }

  // ==== Event Source Management (Phase 8) ====

  /**
   * Register an active event source. Wires its push callback to sendAsync.
   */
  registerSource(nodeId: string, source: EventSource): void {
    this._sources.set(source.id, source);

    source.start((type: string, payload: unknown) => {
      if (this.running) {
        // Use sendAsync to process through the async path
        this.sendAsync(nodeId, type, payload).catch(err => {
          console.error(`GraphReact: Error processing source event for node '${nodeId}':`, err);
        });
      }
    });
  }

  /**
   * Unregister and stop an event source.
   */
  unregisterSource(sourceId: string): void {
    const source = this._sources.get(sourceId);
    if (source) {
      source.stop();
      this._sources.delete(sourceId);
    }
  }

  /** Number of active event sources */
  activeSourceCount(): number {
    return this._sources.size;
  }

  /**
   * Start in daemon mode — evaluates all nodes, then keeps the process
   * alive as long as event sources are active. Returns a Promise that
   * resolves when stopDaemon() is called or all sources stop.
   */
  async startDaemon(): Promise<void> {
    await this.startAsync();

    // If no sources registered during startup, return immediately
    if (this._sources.size === 0) return;

    // Keep alive until stopDaemon is called
    await new Promise<void>((resolve) => {
      this._daemonResolve = resolve;
    });
  }

  /**
   * Stop daemon mode — stop all sources, unmount nodes, resolve daemon promise.
   */
  async stopDaemon(): Promise<void> {
    // Stop all active sources
    const stopPromises: Promise<void>[] = [];
    for (const [id, source] of this._sources) {
      const result = source.stop();
      if (result instanceof Promise) stopPromises.push(result);
    }
    await Promise.all(stopPromises);
    this._sources.clear();

    // Unmount all nodes
    await this.stopAsync();

    // Resolve the daemon promise
    if (this._daemonResolve) {
      this._daemonResolve();
      this._daemonResolve = null;
    }
  }
}
