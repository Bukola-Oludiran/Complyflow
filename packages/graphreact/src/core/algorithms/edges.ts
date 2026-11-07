/**
 * Edge query algorithms for CommunicationGraph.
 */

import type { CommunicationGraph } from '../graph/graph.js';
import type { EdgeAttributes, EdgeTuple } from '../types.js';

export interface EdgeInfo {
  source: string;
  target: string;
  key: string;
  attrs: EdgeAttributes;
}

/**
 * Check if two nodes are directly connected by at least one edge.
 */
export function areConnected(graph: CommunicationGraph, u: string, v: string): boolean {
  return graph.hasEdge(u, v);
}

/**
 * List all edges in the graph with full details (source, target, key, attrs).
 * Each undirected edge appears once.
 */
export function listEdges(graph: CommunicationGraph): EdgeInfo[] {
  const result: EdgeInfo[] = [];
  for (const [u, v, key] of graph.edges()) {
    result.push({
      source: u,
      target: v,
      key,
      attrs: graph.getEdgeData(u, v, key),
    });
  }
  return result;
}

/**
 * List all edges between two specific nodes (including multi-edges).
 * Returns empty array if the nodes aren't connected.
 */
export function listEdgesBetween(graph: CommunicationGraph, u: string, v: string): EdgeInfo[] {
  if (!graph.hasEdge(u, v)) return [];

  const keys = graph.edgeKeys(u, v);
  return keys.map(key => ({
    source: u,
    target: v,
    key,
    attrs: graph.getEdgeData(u, v, key),
  }));
}

/**
 * List all edges connected to a specific node.
 */
export function listEdgesOf(graph: CommunicationGraph, nodeId: string): EdgeInfo[] {
  const result: EdgeInfo[] = [];
  for (const [u, v, key] of graph.edgesOf(nodeId)) {
    result.push({
      source: u,
      target: v,
      key,
      attrs: graph.getEdgeData(u, v, key),
    });
  }
  return result;
}

/**
 * Find all node pairs that share at least one edge.
 * Returns an array of [nodeA, nodeB] pairs (each pair listed once).
 */
export function connectedPairs(graph: CommunicationGraph): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];

  for (const [u, v] of graph.edges()) {
    const canonical = u <= v ? `${u}|${v}` : `${v}|${u}`;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      pairs.push(u <= v ? [u, v] : [v, u]);
    }
  }

  return pairs;
}
