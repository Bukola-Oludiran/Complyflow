/**
 * NodeInstance — the runtime representation of a mounted graph node.
 *
 * Analogous to Preact's component instance. Holds state, hooks, bit flags.
 * Ported from Preact's BaseComponent (src/component.js).
 */

import type {
  NodeComponent,
  NodeDefinition,
  PermissionManifest,
  ChildRef,
  ComposeSpec,
  MessageHandler,
  NodeContext,
  TopologyHandler,
  TopologyFilterOptions,
} from '../types.js';
import { NODE_DIRTY, NODE_MOUNTED, NODE_UNMOUNTED } from './constants.js';
import type { EventSource } from './sources.js';
import { GraphDirectory } from './directory.js';

export interface EffectHookState {
  _value: (() => void | (() => void)) | undefined;
  _args: unknown[] | undefined;
  _pendingArgs: unknown[] | undefined;
  _cleanup: (() => void) | undefined;
}

export interface StateHookState {
  _value: [unknown, (action: unknown) => void];
  _nextValue: [unknown, (action: unknown) => void] | undefined;
  _reducer: (state: unknown, action: unknown) => unknown;
  _node: NodeInstance | undefined;
}

export interface MessageHookState {
  type: string;
  handler: MessageHandler;
}

export interface SourceHookState {
  _source: EventSource | undefined;
  _args: unknown[] | undefined;
  _factory: (() => EventSource) | undefined;
}

export interface TopologyHookState {
  handler: TopologyHandler;
  options?: TopologyFilterOptions;
}

export interface HookStore {
  _list: Array<StateHookState | EffectHookState | MessageHookState | SourceHookState | TopologyHookState | { _value: unknown; _args: unknown[] | undefined }>;
  _pendingEffects: EffectHookState[];
  _messageHandlers: Map<string, MessageHandler[]>;
  _activeSources: Map<string, EventSource>;
  _topologyHandlers: Array<{ handler: TopologyHandler; options?: TopologyFilterOptions }>;
}

export class NodeInstance {
  /** The node definition this instance was created from */
  definition: NodeDefinition;

  /** This node's ID in the graph */
  id: string;

  /** Props passed from .grx or createGraph */
  props: Record<string, unknown>;

  /** Bit flags: dirty, processing, mounted, unmounted */
  _bits: number;

  /** Hook storage (like Preact's __hooks) */
  __hooks: HookStore;

  /** Permission manifest (returned from the component function) */
  manifest: PermissionManifest | null;

  /** Children passed from .grx nesting */
  _externalChildren: ChildRef[];

  /** Children created via ctx.compose() */
  _composedChildren: ComposeSpec[];

  constructor(definition: NodeDefinition, id: string, props: Record<string, unknown> = {}) {
    this.definition = definition;
    this.id = id;
    this.props = props;
    this._bits = 0;
    this.__hooks = {
      _list: [],
      _pendingEffects: [],
      _activeSources: new Map(),
      _messageHandlers: new Map(),
      _topologyHandlers: [],
    };
    this.manifest = null;
    this._externalChildren = [];
    this._composedChildren = [];
  }

  /** Check if a specific flag is set */
  hasFlag(flag: number): boolean {
    return (this._bits & flag) !== 0;
  }

  /** Set a flag */
  setFlag(flag: number): void {
    this._bits |= flag;
  }

  /** Clear a flag */
  clearFlag(flag: number): void {
    this._bits &= ~flag;
  }

  /** Get all children (external first, then composed) */
  get children(): ChildRef[] {
    if (this._externalChildren.length > 0) {
      return this._externalChildren;
    }
    return this._composedChildren.map(spec => ({
      id: spec.id,
      component: spec.component.name,
    }));
  }

  /** Create the NodeContext for the component function */
  createContext(
    getNeighbors: () => string[],
    directory?: GraphDirectory,
    acceptEdgeFn?: (targetId: string) => void,
  ): NodeContext {
    const instance = this;
    const entry = directory?.findById(this.id);
    return {
      id: this.id,
      props: this.props,
      children: this.children,
      neighbors: getNeighbors,
      compose(specs: ComposeSpec[]): void {
        instance._composedChildren = specs;
      },
      directory: directory ?? new GraphDirectory(),
      myDepth: entry?.depth ?? 0,
      myPath: entry?.path ?? [this.id],
      acceptEdge: acceptEdgeFn ?? (() => {}),
    };
  }
}
