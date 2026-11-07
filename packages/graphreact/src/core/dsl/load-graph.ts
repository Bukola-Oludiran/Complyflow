/**
 * loadGraph — convenience function that wraps the full
 * parse → compile → register → start pipeline into one call.
 *
 * Eliminates the bootstrap boilerplate from examples.
 */

import type { NodeDefinition } from '../types.js';
import { Parser } from '../parser/parser.js';
import { compile } from '../parser/compiler.js';
import { registerComponent, clearRegistry } from '../parser/registry.js';
import { Scheduler } from '../runtime/scheduler.js';
import { CommunicationGraph } from '../graph/graph.js';

export interface LoadGraphOptions {
  /** Whether to clear the registry before registering components. Default: true */
  clearBefore?: boolean;
  /** Whether to auto-start the scheduler. Default: true */
  autoStart?: boolean;
  /** Enable async mode (Phase 6). Default: false */
  async?: boolean;
}

export interface LoadedGraph {
  graph: CommunicationGraph;
  scheduler: Scheduler;
}

/**
 * Load a .grx source string, register components, compile, and optionally start.
 *
 * ```ts
 * const { scheduler } = loadGraph(grxSource, { Source, Transform, Sink });
 * // scheduler is already started by default
 * scheduler.send('source', 'produce', { items: [1, 2, 3] });
 * ```
 */
export function loadGraph(
  grxSource: string,
  components: Record<string, NodeDefinition>,
  options: LoadGraphOptions = {}
): LoadedGraph {
  const { clearBefore = true, autoStart = true } = options;

  // Register components
  if (clearBefore) clearRegistry();
  for (const [name, definition] of Object.entries(components)) {
    registerComponent(name, definition);
  }

  // Parse and compile
  const ast = Parser.parse(grxSource);
  const { graph, scheduler } = compile(ast);

  // Auto-start
  if (autoStart) {
    scheduler.start();
  }

  return { graph, scheduler };
}

/**
 * Async version of loadGraph — uses startAsync() for parallel node initialization.
 *
 * ```ts
 * const { scheduler } = await loadGraphAsync(grxSource, { Source, Transform, Sink });
 * await scheduler.sendAsync('source', 'produce', { items: [1, 2, 3] });
 * ```
 */
export async function loadGraphAsync(
  grxSource: string,
  components: Record<string, NodeDefinition>,
  options: Omit<LoadGraphOptions, 'async'> = {}
): Promise<LoadedGraph> {
  const { clearBefore = true, autoStart = true } = options;

  if (clearBefore) clearRegistry();
  for (const [name, definition] of Object.entries(components)) {
    registerComponent(name, definition);
  }

  const ast = Parser.parse(grxSource);
  const { graph, scheduler } = compile(ast);

  if (autoStart) {
    await scheduler.startAsync();
  }

  return { graph, scheduler };
}
