/**
 * Core type definitions for GraphReact.
 */

// --- Graph Types ---

/** Arbitrary key-value attributes on nodes */
export type NodeAttributes = Record<string, unknown>;

/** Arbitrary key-value attributes on edges */
export type EdgeAttributes = Record<string, unknown>;

/** A triple identifying a specific edge in a MultiGraph: [source, target, edgeKey] */
export type EdgeTuple = [string, string, string];

// --- Message Types ---

export interface Message {
  /** Unique message ID */
  id: string;
  /** Message type name (e.g., 'increment', 'count-updated') */
  type: string;
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Arbitrary payload data */
  payload: unknown;
  /** Remaining hops before this message is dropped */
  ttl: number;
  /** Creation timestamp */
  timestamp: number;
}

// --- Permission Types ---

/** Per-neighbor channel policy — defines what a specific connection can do */
export interface ChannelPolicy {
  /** Message types accepted from this neighbor */
  accepts?: string[];
  /** Message types allowed to send to this neighbor */
  emits?: string[];
  /** Transform messages in transit — return modified message or null to drop */
  transform?: (msg: IncomingMessage) => IncomingMessage | null;
  /** Max messages per second from this neighbor */
  rateLimit?: number;
  /** Delivery priority (higher = delivered first) */
  priority?: number;
}

export interface PermissionManifest {
  /** Message types this node accepts (global fallback for all edges) */
  accepts: string[];
  /** Message types this node emits (global fallback) */
  emits: string[];
  /** Per-neighbor channel policies — overrides global accepts/emits per connection.
   *  Use '*' key as default for unlisted neighbors. */
  channels?: Record<string, ChannelPolicy>;
}

// --- Hook Types ---

export type SetStateAction<S> = S | ((prev: S) => S);
export type Dispatch<A> = (action: A) => void;
export type StateUpdater<S> = Dispatch<SetStateAction<S>>;
export type Reducer<S, A> = (state: S, action: A) => S;

export type EffectCleanup = void | (() => void);
export type EffectCallback = () => EffectCleanup;

// Async variants (Phase 6 — opt-in)
export type AsyncEffectCleanup = void | (() => void) | (() => Promise<void>);
export type AsyncEffectCallback = () => AsyncEffectCleanup | Promise<AsyncEffectCleanup>;
export type AsyncMessageHandler = (msg: IncomingMessage) => void | Promise<void>;

export interface HookState {
  _value: unknown;
  _args: unknown[] | undefined;
  _cleanup: (() => void) | undefined;
  _nextValue: unknown;
  _pendingArgs: unknown[] | undefined;
}

// --- Node Component Types ---

export interface ChildRef {
  id: string;
  component: string;
}

export interface ComposeSpec {
  component: NodeDefinition;
  id: string;
  props?: Record<string, unknown>;
}

export interface NodeContext {
  /** This node's ID in the graph */
  id: string;
  /** Props passed from .grx attributes or createGraph */
  props: Record<string, unknown>;
  /** Children nested under this node in .grx (children-as-props) */
  children: ChildRef[];
  /** Get IDs of all adjacent nodes */
  neighbors(): string[];
  /** Compose default internal children (used when no .grx children provided) */
  compose(specs: ComposeSpec[]): void;
  /** Graph directory — structural summary of all nodes (shared, read-only) */
  directory: import('./runtime/directory.js').GraphDirectory;
  /** This node's depth in the hierarchy (0 = root) */
  myDepth: number;
  /** This node's ancestry path from root */
  myPath: string[];
  /** Accept an edge from another node (creates a real bidirectional edge) */
  acceptEdge(targetId: string): void;
}

export type NodeComponent = (ctx: NodeContext) => PermissionManifest;

export interface NodeDefinition {
  name: string;
  component: NodeComponent;
}

// --- Message Handler Types ---

export interface IncomingMessage {
  from: string;
  type: string;
  payload: unknown;
  ttl: number;
}

export type MessageHandler = (msg: IncomingMessage) => void;

export interface EmitOptions {
  /** Target specific neighbor(s) instead of broadcasting */
  to?: string | string[];
  /** Override default TTL */
  ttl?: number;
  /** Target specific edge key (for multi-edges) */
  edgeKey?: string;
  /** Send directly to a node by ID, bypassing edge checks (like a DM) */
  direct?: string;
}

export type EmitFunction = (type: string, payload: unknown, opts?: EmitOptions) => void;

// --- Topology Event Types ---

/** Events fired when the graph structure changes */
export type TopologyEvent =
  | { type: 'node-added'; nodeId: string }
  | { type: 'node-removed'; nodeId: string }
  | { type: 'edge-added'; u: string; v: string; key: string }
  | { type: 'edge-removed'; u: string; v: string; key: string }
  | { type: 'edge-updated'; u: string; v: string; key: string };

/** Handler for topology change events */
export type TopologyHandler = (event: TopologyEvent) => void;

/** Filter options for useTopology hook */
export interface TopologyFilterOptions {
  /** Only receive events of these types */
  types?: TopologyEvent['type'][];
  /** Only receive events involving this node's direct neighbors */
  neighbors?: boolean;
}

// --- Runtime Types ---

export interface GraphReactRuntime {
  /** Start the runtime: mount all nodes, begin processing */
  start(): void;
  /** Stop the runtime: unmount all nodes, flush messages */
  stop(): void;
  /** Inject a message into the graph from outside */
  send(nodeId: string, type: string, payload: unknown): void;
}
