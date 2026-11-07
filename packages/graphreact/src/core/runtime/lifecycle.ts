/**
 * Node lifecycle management — mount, update, unmount.
 * Extracted from the scheduler for clarity.
 */

import type { NodeInstance } from './node-instance.js';
import type { CommunicationGraph } from '../graph/graph.js';
import type { GraphDirectory } from './directory.js';
import { NODE_DIRTY, NODE_PROCESSING, NODE_MOUNTED, NODE_UNMOUNTED } from './constants.js';
import { setCurrentNode, flushEffects, flushEffectsAsync, cleanupEffects, cleanupEffectsAsync } from './hooks.js';

export interface EvalOptions {
  directory?: GraphDirectory;
  acceptEdgeFn?: (targetId: string) => void;
}

/**
 * Evaluate (mount or update) a node instance.
 * Sets up hook context, executes the component function, flushes effects.
 */
export function evaluateNode(node: NodeInstance, graph: CommunicationGraph, opts?: EvalOptions): void {
  node.clearFlag(NODE_DIRTY);
  node.setFlag(NODE_PROCESSING);

  node.__hooks._messageHandlers.clear();
  node.__hooks._topologyHandlers = [];
  setCurrentNode(node);

  try {
    const ctx = node.createContext(
      () => graph.neighbors(node.id),
      opts?.directory,
      opts?.acceptEdgeFn,
    );
    const manifest = node.definition.component(ctx);
    node.manifest = manifest;
  } finally {
    setCurrentNode(null);
    node.clearFlag(NODE_PROCESSING);
  }

  flushEffects(node);

  if (!node.hasFlag(NODE_MOUNTED)) {
    node.setFlag(NODE_MOUNTED);
  }
}

/**
 * Async version of evaluateNode — awaits async effects.
 */
export async function evaluateNodeAsync(node: NodeInstance, graph: CommunicationGraph, opts?: EvalOptions): Promise<void> {
  node.clearFlag(NODE_DIRTY);
  node.setFlag(NODE_PROCESSING);

  node.__hooks._messageHandlers.clear();
  node.__hooks._topologyHandlers = [];
  setCurrentNode(node);

  try {
    const ctx = node.createContext(
      () => graph.neighbors(node.id),
      opts?.directory,
      opts?.acceptEdgeFn,
    );
    const manifest = node.definition.component(ctx);
    node.manifest = manifest;
  } finally {
    setCurrentNode(null);
    node.clearFlag(NODE_PROCESSING);
  }

  await flushEffectsAsync(node);

  if (!node.hasFlag(NODE_MOUNTED)) {
    node.setFlag(NODE_MOUNTED);
  }
}

/**
 * Unmount a node — run all effect cleanups, set unmounted flag.
 */
export function unmountNode(node: NodeInstance): void {
  cleanupEffects(node);
  node.setFlag(NODE_UNMOUNTED);
}

/**
 * Async unmount — awaits async cleanups.
 */
export async function unmountNodeAsync(node: NodeInstance): Promise<void> {
  await cleanupEffectsAsync(node);
  node.setFlag(NODE_UNMOUNTED);
}
