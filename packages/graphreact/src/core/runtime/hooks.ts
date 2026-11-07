/**
 * Hook implementations for GraphReact nodes.
 *
 * Ported from Preact's hooks (hooks/src/index.js).
 * Module-level state (currentNode, currentIndex) follows Preact's pattern
 * where currentComponent and currentIndex are set before executing the
 * component function.
 */

import type {
  SetStateAction,
  Reducer,
  EffectCallback,
  MessageHandler,
  EmitFunction,
  EmitOptions,
  IncomingMessage,
  TopologyHandler,
  TopologyFilterOptions,
} from '../types.js';
import type {
  NodeInstance,
  EffectHookState,
  StateHookState,
  MessageHookState,
  SourceHookState,
  TopologyHookState,
} from './node-instance.js';
import type { EventSource, EventSourceFactory } from './sources.js';

// --- Module-level state (like Preact's currentComponent / currentIndex) ---

let currentNode: NodeInstance | null = null;
let currentIndex = 0;

/** Set the active node before executing its component function */
export function setCurrentNode(node: NodeInstance | null): void {
  currentNode = node;
  currentIndex = 0;
}

export function getCurrentNode(): NodeInstance | null {
  return currentNode;
}

// Scheduler callback — set by the scheduler to allow hooks to trigger re-evaluation
let enqueueNodeUpdate: ((node: NodeInstance) => void) | null = null;

export function setEnqueueNodeUpdate(fn: (node: NodeInstance) => void): void {
  enqueueNodeUpdate = fn;
}

// Emit callback — set by the scheduler to allow useEmit to send messages
let emitCallback: ((from: string, type: string, payload: unknown, opts?: EmitOptions) => void) | null = null;

export function setEmitCallback(
  fn: (from: string, type: string, payload: unknown, opts?: EmitOptions) => void
): void {
  emitCallback = fn;
}

// Source registration callback — set by the scheduler
let sourceRegisterCallback: ((nodeId: string, source: EventSource) => void) | null = null;
let sourceUnregisterCallback: ((sourceId: string) => void) | null = null;

export function setSourceCallbacks(
  register: (nodeId: string, source: EventSource) => void,
  unregister: (sourceId: string) => void
): void {
  sourceRegisterCallback = register;
  sourceUnregisterCallback = unregister;
}

// --- Hook state access (ported from Preact's getHookState) ---

function getHookState(index: number): any {
  if (!currentNode) {
    throw new Error('Hooks can only be called inside a node component function');
  }

  const hooks = currentNode.__hooks;
  if (index >= hooks._list.length) {
    hooks._list.push({} as any);
  }
  return hooks._list[index];
}

/**
 * Compare dependency arrays. Ported from Preact's argsChanged().
 */
function argsChanged(oldArgs: unknown[] | undefined, newArgs: unknown[] | undefined): boolean {
  if (oldArgs === undefined || newArgs === undefined) return true;
  if (oldArgs.length !== newArgs.length) return true;
  for (let i = 0; i < oldArgs.length; i++) {
    if (!Object.is(oldArgs[i], newArgs[i])) return true;
  }
  return false;
}

// --- Public hooks ---

/**
 * useState — node-local state. Delegates to useReducer (like Preact).
 */
export function useState<S>(initialState: S | (() => S)): [S, (action: SetStateAction<S>) => void] {
  return useReducer(
    invokeOrReturn as Reducer<S, SetStateAction<S>>,
    initialState as S
  );
}

/**
 * useReducer — complex state management.
 * Ported from Preact's useReducer (hooks/src/index.js:185-271).
 */
export function useReducer<S, A>(
  reducer: Reducer<S, A>,
  initialState: S,
  init?: (initial: S) => S
): [S, (action: A) => void] {
  const hookState = getHookState(currentIndex++) as StateHookState;

  if (!hookState._value) {
    // First call: initialize
    const initial = init ? init(initialState) : initialState;
    hookState._reducer = reducer as (state: unknown, action: unknown) => unknown;
    hookState._value = [
      initial,
      (action: unknown) => {
        const currentValue = hookState._nextValue
          ? hookState._nextValue[0]
          : hookState._value[0];
        const nextValue = hookState._reducer(currentValue, action);

        if (!Object.is(currentValue, nextValue)) {
          hookState._nextValue = [nextValue, hookState._value[1]];
          if (enqueueNodeUpdate) {
            enqueueNodeUpdate(hookState._node!);
          }
        }
      },
    ];
    hookState._node = currentNode ?? undefined;
  } else {
    // Update the reducer in case it changed
    hookState._reducer = reducer as (state: unknown, action: unknown) => unknown;
  }

  // Apply pending state if exists
  if (hookState._nextValue) {
    hookState._value = [hookState._nextValue[0], hookState._value[1]];
    hookState._nextValue = undefined;
  }

  return hookState._value as [S, (action: A) => void];
}

/**
 * useEffect — side effects with dependency tracking.
 * Ported from Preact's useEffect (hooks/src/index.js:278-287).
 */
export function useEffect(callback: EffectCallback, args?: unknown[]): void {
  const state = getHookState(currentIndex++) as EffectHookState;

  if (argsChanged(state._args, args)) {
    state._value = callback;
    state._pendingArgs = args;
    currentNode!.__hooks._pendingEffects.push(state);
  }
}

/**
 * useMemo — memoized computation with dependency tracking.
 */
export function useMemo<T>(factory: () => T, args: unknown[]): T {
  const state = getHookState(currentIndex++);

  if (argsChanged(state._args, args)) {
    state._value = factory();
    state._args = args;
  }

  return state._value as T;
}

/**
 * useCallback — memoized callback (implemented via useMemo, like React).
 */
export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  args: unknown[]
): T {
  return useMemo(() => callback, args);
}

/**
 * useMessage — declare a handler for incoming messages of a given type.
 * GraphReact-specific hook (no Preact analog).
 */
export function useMessage(type: string, handler: MessageHandler): void {
  if (!currentNode) {
    throw new Error('useMessage can only be called inside a node component function');
  }

  const hookState = getHookState(currentIndex++) as MessageHookState;
  hookState.type = type;
  hookState.handler = handler;

  // Register in the message handler map (rebuilt each evaluation since
  // scheduler clears _messageHandlers before re-eval)
  const handlers = currentNode.__hooks._messageHandlers;
  if (!handlers.has(type)) {
    handlers.set(type, []);
  }
  handlers.get(type)!.push(handler);
}

/**
 * useEmit — returns a function to send messages to neighbors.
 * GraphReact-specific hook.
 */
export function useEmit(): EmitFunction {
  if (!currentNode) {
    throw new Error('useEmit can only be called inside a node component function');
  }

  const nodeId = currentNode.id;
  return (type: string, payload: unknown, opts?: EmitOptions) => {
    if (emitCallback) {
      emitCallback(nodeId, type, payload, opts);
    }
  };
}

// --- Graph query hooks ---

// Neighbor query callback — set by the scheduler
let neighborsCallback: ((nodeId: string) => string[]) | null = null;

export function setNeighborsCallback(fn: (nodeId: string) => string[]): void {
  neighborsCallback = fn;
}

// Graph query callback — set by the scheduler
let graphQueryCallback: ((queryFn: (graph: any) => unknown) => unknown) | null = null;

export function setGraphQueryCallback(fn: (queryFn: (graph: any) => unknown) => unknown): void {
  graphQueryCallback = fn;
}

/**
 * useNeighbors — reactive list of neighbor IDs.
 * Optionally filter by a predicate.
 */
export function useNeighbors(filter?: (neighborId: string) => boolean): string[] {
  if (!currentNode) {
    throw new Error('useNeighbors can only be called inside a node component function');
  }

  const nodeId = currentNode.id;
  const allNeighbors = neighborsCallback ? neighborsCallback(nodeId) : [];
  return filter ? allNeighbors.filter(filter) : allNeighbors;
}

/**
 * useGraphQuery — read-only query into the graph engine.
 * The query function receives the CommunicationGraph and returns a value.
 * Result is memoized by the dependency array.
 */
export function useGraphQuery<T>(queryFn: (graph: any) => T, deps: unknown[]): T {
  return useMemo(() => {
    if (!graphQueryCallback) {
      throw new Error('useGraphQuery: graph query callback not set');
    }
    return graphQueryCallback(queryFn) as T;
  }, deps);
}

// --- Event Source Hook ---

/**
 * useSource — subscribe to an external event source.
 * The source is created on mount (or when deps change) and stopped on unmount.
 * Events from the source are pushed into the graph as messages to this node.
 *
 * ```typescript
 * useSource(() => timerSource(5000), []);
 * useMessage('tick', (msg) => { ... });
 * ```
 */
export function useSource(factory: EventSourceFactory, deps?: unknown[]): void {
  if (!currentNode) {
    throw new Error('useSource can only be called inside a node component function');
  }

  const state = getHookState(currentIndex++) as SourceHookState;

  if (argsChanged(state._args, deps)) {
    // Stop old source if exists
    if (state._source) {
      const oldSource = state._source;
      if (sourceUnregisterCallback) sourceUnregisterCallback(oldSource.id);
      currentNode.__hooks._activeSources.delete(oldSource.id);
      const stopResult = oldSource.stop();
      // If async stop, we can't await here — it'll be cleaned up
      if (stopResult instanceof Promise) {
        stopResult.catch(() => {}); // swallow async cleanup errors in sync context
      }
    }

    // Create and start new source
    const source = factory();
    state._source = source;
    state._args = deps;
    state._factory = factory;

    const nodeId = currentNode.id;
    currentNode.__hooks._activeSources.set(source.id, source);

    if (sourceRegisterCallback) {
      sourceRegisterCallback(nodeId, source);
    }
  }
}

// --- Topology Hook ---

/**
 * useTopology — register a handler for graph topology change events.
 * GraphReact-specific hook. Follows the useMessage pattern.
 *
 * @param handler Called when topology changes matching the filter occur
 * @param opts Optional filter to narrow which events are received
 */
export function useTopology(handler: TopologyHandler, opts?: TopologyFilterOptions): void {
  if (!currentNode) {
    throw new Error('useTopology can only be called inside a node component function');
  }

  const hookState = getHookState(currentIndex++) as TopologyHookState;
  hookState.handler = handler;
  hookState.options = opts;

  // Register in the node's topology handler list (rebuilt each evaluation)
  currentNode.__hooks._topologyHandlers.push({ handler, options: opts });
}

// --- Utility ---

/** If value is a function, call it with state; otherwise return it (like Preact's invokeOrReturn) */
function invokeOrReturn<S>(state: S, update: SetStateAction<S>): S {
  return typeof update === 'function' ? (update as (s: S) => S)(state) : update;
}

/**
 * Run pending effects for a node instance.
 * Called by the scheduler after a node re-evaluates.
 */
export function flushEffects(node: NodeInstance): void {
  const effects = node.__hooks._pendingEffects;
  for (const effect of effects) {
    // Run cleanup from previous effect
    if (effect._cleanup) {
      effect._cleanup();
      effect._cleanup = undefined;
    }
    // Run the new effect
    if (effect._value) {
      const cleanup = effect._value();
      if (typeof cleanup === 'function') {
        effect._cleanup = cleanup;
      }
    }
    // Commit the args
    effect._args = effect._pendingArgs;
    effect._pendingArgs = undefined;
  }
  // Clear pending effects
  node.__hooks._pendingEffects = [];
}

/**
 * Async version of flushEffects — awaits Promise-returning effects and cleanups.
 * Used by the async scheduler (Phase 6 opt-in). Sync effects work unchanged.
 */
export async function flushEffectsAsync(node: NodeInstance): Promise<void> {
  const effects = node.__hooks._pendingEffects;
  for (const effect of effects) {
    // Run cleanup from previous effect (may be async)
    if (effect._cleanup) {
      const cleanupResult = (effect._cleanup as () => void | Promise<void>)();
      if (cleanupResult instanceof Promise) await cleanupResult;
      effect._cleanup = undefined;
    }
    // Run the new effect (may return Promise)
    if (effect._value) {
      const result = (effect._value as () => unknown)();
      const resolved = result instanceof Promise ? await result : result;
      if (typeof resolved === 'function') {
        effect._cleanup = resolved as () => void;
      }
    }
    // Commit the args
    effect._args = effect._pendingArgs;
    effect._pendingArgs = undefined;
  }
  node.__hooks._pendingEffects = [];
}

/**
 * Async version of cleanupEffects — awaits async cleanups during unmount.
 */
export async function cleanupEffectsAsync(node: NodeInstance): Promise<void> {
  // Stop all active sources
  for (const [id, source] of node.__hooks._activeSources) {
    if (sourceUnregisterCallback) sourceUnregisterCallback(id);
    const result = source.stop();
    if (result instanceof Promise) await result;
  }
  node.__hooks._activeSources.clear();

  // Run effect cleanups
  for (const hookState of node.__hooks._list) {
    const effect = hookState as EffectHookState;
    if (effect._cleanup) {
      const result = (effect._cleanup as () => void | Promise<void>)();
      if (result instanceof Promise) await result;
      effect._cleanup = undefined;
    }
  }
}

/**
 * Run all effect cleanups for a node (during unmount).
 */
export function cleanupEffects(node: NodeInstance): void {
  // Stop all active sources (sync — fire and forget for async stop)
  for (const [id, source] of node.__hooks._activeSources) {
    if (sourceUnregisterCallback) sourceUnregisterCallback(id);
    source.stop();
  }
  node.__hooks._activeSources.clear();

  for (const hookState of node.__hooks._list) {
    const effect = hookState as EffectHookState;
    if (effect._cleanup) {
      effect._cleanup();
      effect._cleanup = undefined;
    }
  }
}
