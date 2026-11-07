/**
 * createGraph — TypeScript builder API for programmatic graph construction.
 * Secondary to .grx files, but useful for testing and dynamic graphs.
 */

import type { NodeDefinition, EdgeAttributes } from '../types.js';
import { CommunicationGraph } from '../graph/graph.js';
import { NodeInstance } from '../runtime/node-instance.js';
import { Scheduler } from '../runtime/scheduler.js';

export interface GraphBuilder {
  addNode(id: string, definition: NodeDefinition, props?: Record<string, unknown>): void;
  addEdge(u: string, v: string, key?: string, attrs?: EdgeAttributes): void;
}

export interface BuiltGraph {
  graph: CommunicationGraph;
  scheduler: Scheduler;
}

/**
 * Build a graph using a builder callback.
 *
 * ```ts
 * const { scheduler } = createGraph('my-graph', (g) => {
 *   g.addNode('a', CounterNode, { initialCount: 0 });
 *   g.addNode('b', LoggerNode);
 *   g.addEdge('a', 'b');
 * });
 * scheduler.start();
 * ```
 */
export function createGraph(
  name: string,
  builderFn: (g: GraphBuilder) => void
): BuiltGraph {
  const graph = new CommunicationGraph();
  graph.graph.name = name;

  const nodeDefinitions = new Map<string, { definition: NodeDefinition; props: Record<string, unknown> }>();

  const builder: GraphBuilder = {
    addNode(id: string, definition: NodeDefinition, props: Record<string, unknown> = {}) {
      nodeDefinitions.set(id, { definition, props });
      graph.addNode(id, { component: definition.name, ...props });
    },
    addEdge(u: string, v: string, key?: string, attrs: EdgeAttributes = {}) {
      graph.addEdge(u, v, key, attrs);
    },
  };

  builderFn(builder);

  // Create scheduler and register node instances
  const scheduler = new Scheduler(graph);

  for (const [id, { definition, props }] of nodeDefinitions) {
    const instance = new NodeInstance(definition, id, props);
    scheduler.registerNode(instance);
  }

  return { graph, scheduler };
}
