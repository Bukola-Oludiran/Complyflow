/**
 * Pathfinding algorithms — shortestPath, allPaths, aStarPath.
 *
 * All three accept an optional edgeFilter, which also addresses
 * the "edge-filtered traversal" gap in the graph engine.
 */

import type { CommunicationGraph } from '../graph/graph.js';
import type { GraphDirectory } from '../runtime/directory.js';
import type { EdgeAttributes } from '../types.js';

/**
 * Filter predicate for edges. Return true to allow traversal.
 */
export type EdgeFilter = (
  u: string,
  v: string,
  key: string,
  attrs: EdgeAttributes
) => boolean;

/**
 * Heuristic function for A* search.
 * Must return a non-negative estimate of cost from `current` to `target`.
 * Must be admissible (never overestimate) for optimal results.
 */
export type PathHeuristic = (
  current: string,
  target: string,
  graph: CommunicationGraph,
  directory?: GraphDirectory
) => number;

export interface PathOptions {
  /** Only traverse edges where this predicate returns true */
  edgeFilter?: EdgeFilter;
}

export interface AllPathsOptions extends PathOptions {
  /** Maximum path length (number of edges). Prevents combinatorial explosion. */
  maxDepth?: number;
}

export interface AStarOptions extends PathOptions {
  /** Heuristic function guiding the search */
  heuristic?: PathHeuristic;
  /** Directory available to the heuristic for structural queries */
  directory?: GraphDirectory;
}

// ---- Helpers ----

/**
 * Returns the filtered neighbors of a node — only those reachable
 * through at least one edge that passes the edgeFilter.
 */
function filteredNeighbors(
  graph: CommunicationGraph,
  node: string,
  edgeFilter?: EdgeFilter
): string[] {
  const neighbors = graph.neighbors(node);
  if (!edgeFilter) return neighbors;

  return neighbors.filter((neighbor) => {
    const keys = graph.edgeKeys(node, neighbor);
    return keys.some((key) =>
      edgeFilter(node, neighbor, key, graph.getEdgeData(node, neighbor, key))
    );
  });
}

function assertNode(graph: CommunicationGraph, id: string): void {
  if (!graph.hasNode(id)) {
    throw new Error(`Node '${id}' not in graph`);
  }
}

// ---- shortestPath ----

/**
 * Find the shortest path (by hop count) between `source` and `target`
 * using BFS. Returns the node sequence, or null if no path exists.
 *
 * Complexity: O(V + E)
 */
export function shortestPath(
  graph: CommunicationGraph,
  source: string,
  target: string,
  opts?: PathOptions
): string[] | null {
  assertNode(graph, source);
  assertNode(graph, target);

  if (source === target) return [source];

  const visited = new Set<string>([source]);
  const parent = new Map<string, string>();

  const queue: string[] = [source];

  while (queue.length > 0) {
    const nextQueue: string[] = [];

    for (const node of queue) {
      for (const neighbor of filteredNeighbors(graph, node, opts?.edgeFilter)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, node);

        if (neighbor === target) {
          // Reconstruct path
          const path: string[] = [target];
          let current = target;
          while (current !== source) {
            current = parent.get(current)!;
            path.push(current);
          }
          return path.reverse();
        }

        nextQueue.push(neighbor);
      }
    }

    queue.length = 0;
    queue.push(...nextQueue);
  }

  return null;
}

// ---- allPaths ----

/**
 * Find all simple paths between `source` and `target` using DFS.
 * Returns an array of node sequences. Optional `maxDepth` bounds
 * the search to prevent combinatorial explosion in dense graphs.
 *
 * A simple path visits each node at most once.
 */
export function allPaths(
  graph: CommunicationGraph,
  source: string,
  target: string,
  opts?: AllPathsOptions
): string[][] {
  assertNode(graph, source);
  assertNode(graph, target);

  if (source === target) return [[source]];

  const results: string[][] = [];
  const visited = new Set<string>([source]);
  const path: string[] = [source];

  // Iterative DFS with explicit stack
  // Each frame: [neighbors list, index into that list]
  const stack: Array<{ neighbors: string[]; index: number }> = [
    { neighbors: filteredNeighbors(graph, source, opts?.edgeFilter), index: 0 },
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.index >= frame.neighbors.length) {
      // Backtrack
      stack.pop();
      const removed = path.pop()!;
      visited.delete(removed);
      continue;
    }

    const neighbor = frame.neighbors[frame.index++];

    if (neighbor === target) {
      results.push([...path, target]);
      continue;
    }

    if (visited.has(neighbor)) continue;

    if (opts?.maxDepth !== undefined && path.length >= opts.maxDepth) continue;

    visited.add(neighbor);
    path.push(neighbor);
    stack.push({
      neighbors: filteredNeighbors(graph, neighbor, opts?.edgeFilter),
      index: 0,
    });
  }

  return results;
}

// ---- aStarPath ----

/**
 * A* search from `source` to `target` with a pluggable heuristic.
 *
 * The heuristic receives the graph and optional directory so it can
 * inspect node attributes, edge attributes, and structural info
 * (depth, role, subtree) to guide the search.
 *
 * Without a heuristic, degrades to Dijkstra with uniform edge weight
 * (equivalent to BFS shortest path).
 *
 * Returns the node sequence, or null if no path exists.
 */
export function aStarPath(
  graph: CommunicationGraph,
  source: string,
  target: string,
  opts?: AStarOptions
): string[] | null {
  assertNode(graph, source);
  assertNode(graph, target);

  if (source === target) return [source];

  const heuristic = opts?.heuristic ?? (() => 0);
  const directory = opts?.directory;

  // gScore: best known cost from source to node
  const gScore = new Map<string, number>([[source, 0]]);
  // fScore: gScore + heuristic estimate
  const fScore = new Map<string, number>([
    [source, heuristic(source, target, graph, directory)],
  ]);
  // Parent tracking for path reconstruction
  const cameFrom = new Map<string, string>();
  // Open set — nodes to explore. Using a simple array-based min-heap
  // would be optimal but for correctness and clarity we use a sorted set.
  // For the graph sizes GraphReact targets, this is adequate.
  const openSet = new Set<string>([source]);
  const closedSet = new Set<string>();

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current: string | null = null;
    let bestF = Infinity;
    for (const node of openSet) {
      const f = fScore.get(node) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = node;
      }
    }

    if (current === null) break;

    if (current === target) {
      // Reconstruct path
      const path: string[] = [target];
      let node = target;
      while (node !== source) {
        node = cameFrom.get(node)!;
        path.push(node);
      }
      return path.reverse();
    }

    openSet.delete(current);
    closedSet.add(current);

    const neighbors = filteredNeighbors(graph, current, opts?.edgeFilter);
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor)) continue;

      // Uniform edge weight of 1 (hop count)
      const tentativeG = (gScore.get(current) ?? Infinity) + 1;

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(
          neighbor,
          tentativeG + heuristic(neighbor, target, graph, directory)
        );
        openSet.add(neighbor);
      }
    }
  }

  return null;
}
