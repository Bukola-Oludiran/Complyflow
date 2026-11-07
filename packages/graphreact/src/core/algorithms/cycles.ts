/**
 * Cycle detection for undirected graphs.
 * Ported from NetworkX (networkx/algorithms/cycles.py).
 */

import type { CommunicationGraph } from '../graph/graph.js';

/**
 * Find a cycle in an undirected graph. Returns the cycle as an array
 * of [u, v] edge pairs, or null if no cycle exists.
 *
 * Uses DFS: a back-edge to an already-visited node (that isn't the
 * direct parent) indicates a cycle.
 */
export function findCycle(graph: CommunicationGraph): [string, string][] | null {
  const visited = new Set<string>();

  for (const startNode of graph.nodes()) {
    if (visited.has(startNode)) continue;

    // DFS stack: [currentNode, parentNode, neighborIndex, neighbors]
    const stack: Array<{
      node: string;
      parent: string | null;
      neighbors: string[];
      index: number;
    }> = [{ node: startNode, parent: null, neighbors: graph.neighbors(startNode), index: 0 }];

    visited.add(startNode);
    // Track the path for cycle reconstruction
    const parentMap = new Map<string, string | null>();
    parentMap.set(startNode, null);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];

      if (top.index >= top.neighbors.length) {
        stack.pop();
        continue;
      }

      const nbr = top.neighbors[top.index++];

      if (!visited.has(nbr)) {
        visited.add(nbr);
        parentMap.set(nbr, top.node);
        stack.push({
          node: nbr,
          parent: top.node,
          neighbors: graph.neighbors(nbr),
          index: 0,
        });
      } else if (nbr !== top.parent) {
        // Found a cycle — reconstruct it
        const cycle: [string, string][] = [[top.node, nbr]];
        let current = top.node;
        while (current !== nbr) {
          const prev = parentMap.get(current)!;
          cycle.push([prev, current]);
          current = prev;
          if (current === null) break;
        }
        cycle.reverse();
        return cycle;
      }
    }
  }

  return null;
}

/**
 * Check if the graph has any cycles.
 */
export function hasCycle(graph: CommunicationGraph): boolean {
  return findCycle(graph) !== null;
}
