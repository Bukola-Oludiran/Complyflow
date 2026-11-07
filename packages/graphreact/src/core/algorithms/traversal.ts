/**
 * Graph traversal algorithms — BFS and DFS.
 * Ported from NetworkX (networkx/algorithms/traversal/).
 */

import type { CommunicationGraph } from '../graph/graph.js';

/**
 * Breadth-first search edges starting from `source`.
 * Yields [parent, child] pairs in BFS order.
 *
 * Ported from NetworkX generic_bfs_edges().
 */
export function* bfsEdges(
  graph: CommunicationGraph,
  source: string,
  depthLimit?: number
): IterableIterator<[string, string]> {
  if (!graph.hasNode(source)) {
    throw new Error(`Node '${source}' not in graph`);
  }

  const visited = new Set<string>([source]);
  // Queue entries: [node, depth, neighbors iterator]
  let queue: Array<[string, number, string[]]> = [
    [source, 0, graph.neighbors(source)],
  ];

  while (queue.length > 0) {
    const nextQueue: Array<[string, number, string[]]> = [];

    for (const [parent, depth, neighbors] of queue) {
      if (depthLimit !== undefined && depth >= depthLimit) continue;

      for (const child of neighbors) {
        if (!visited.has(child)) {
          visited.add(child);
          yield [parent, child];
          nextQueue.push([child, depth + 1, graph.neighbors(child)]);
        }
      }
    }

    queue = nextQueue;
  }
}

/**
 * Breadth-first search node iteration from `source`.
 * Yields nodes in BFS order (source first).
 */
export function* bfsNodes(
  graph: CommunicationGraph,
  source: string,
  depthLimit?: number
): IterableIterator<string> {
  yield source;
  for (const [, child] of bfsEdges(graph, source, depthLimit)) {
    yield child;
  }
}

/**
 * Depth-first search edges starting from `source`.
 * Yields [parent, child] pairs in DFS order.
 *
 * Ported from NetworkX generic_dfs_edges() — iterative stack-based.
 */
export function* dfsEdges(
  graph: CommunicationGraph,
  source: string,
  depthLimit?: number
): IterableIterator<[string, string]> {
  if (!graph.hasNode(source)) {
    throw new Error(`Node '${source}' not in graph`);
  }

  const visited = new Set<string>([source]);
  // Stack entries: [parent, depth, neighbors iterator index, neighbors]
  const stack: Array<{ parent: string; depth: number; neighbors: string[]; index: number }> = [
    { parent: source, depth: 0, neighbors: graph.neighbors(source), index: 0 },
  ];

  while (stack.length > 0) {
    const top = stack[stack.length - 1];

    if (top.index >= top.neighbors.length) {
      stack.pop();
      continue;
    }

    const child = top.neighbors[top.index++];

    if (!visited.has(child)) {
      visited.add(child);
      yield [top.parent, child];

      if (depthLimit === undefined || top.depth + 1 < depthLimit) {
        stack.push({
          parent: child,
          depth: top.depth + 1,
          neighbors: graph.neighbors(child),
          index: 0,
        });
      }
    }
  }
}

/**
 * DFS node iteration from `source`. Yields nodes in DFS order.
 */
export function* dfsNodes(
  graph: CommunicationGraph,
  source: string,
  depthLimit?: number
): IterableIterator<string> {
  yield source;
  for (const [, child] of dfsEdges(graph, source, depthLimit)) {
    yield child;
  }
}
