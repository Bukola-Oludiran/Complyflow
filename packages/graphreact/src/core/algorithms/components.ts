/**
 * Connected components for undirected graphs.
 * Ported from NetworkX (networkx/algorithms/components/connected.py).
 */

import type { CommunicationGraph } from '../graph/graph.js';
import { bfsNodes } from './traversal.js';

/**
 * Yield sets of nodes, one for each connected component.
 * Ported from NetworkX connected_components().
 */
export function* connectedComponents(
  graph: CommunicationGraph
): IterableIterator<Set<string>> {
  const seen = new Set<string>();

  for (const node of graph.nodes()) {
    if (seen.has(node)) continue;

    const component = new Set<string>();
    for (const n of bfsNodes(graph, node)) {
      component.add(n);
      seen.add(n);
    }
    yield component;
  }
}

/**
 * Check if the graph is connected (all nodes reachable from any node).
 */
export function isConnected(graph: CommunicationGraph): boolean {
  if (graph.order() === 0) return true;

  const firstNode = graph.nodes().next().value!;
  let count = 0;
  for (const _ of bfsNodes(graph, firstNode)) {
    count++;
  }
  return count === graph.order();
}

/**
 * Number of connected components.
 */
export function numberOfConnectedComponents(graph: CommunicationGraph): number {
  let count = 0;
  for (const _ of connectedComponents(graph)) {
    count++;
  }
  return count;
}
