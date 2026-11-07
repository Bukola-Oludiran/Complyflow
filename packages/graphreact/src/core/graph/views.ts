/**
 * Lazy subgraph views — filtered views over a CommunicationGraph
 * without copying data.
 *
 * Ported from NetworkX (networkx/classes/graphviews.py).
 */

import type { NodeAttributes, EdgeAttributes, EdgeTuple } from '../types.js';
import { CommunicationGraph } from './graph.js';

/**
 * A read-only, lazily-filtered view of a CommunicationGraph.
 * Filters are applied on-the-fly during iteration — no data is copied.
 */
export class SubgraphView {
  private _source: CommunicationGraph;
  private _nodeFilter: (id: string) => boolean;
  private _edgeFilter: (u: string, v: string, key: string) => boolean;

  constructor(
    source: CommunicationGraph,
    nodeFilter?: (id: string) => boolean,
    edgeFilter?: (u: string, v: string, key: string) => boolean
  ) {
    this._source = source;
    this._nodeFilter = nodeFilter ?? (() => true);
    this._edgeFilter = edgeFilter ?? (() => true);
  }

  hasNode(id: string): boolean {
    return this._source.hasNode(id) && this._nodeFilter(id);
  }

  getNodeData(id: string): NodeAttributes {
    if (!this.hasNode(id)) throw new Error(`Node '${id}' not in subgraph view`);
    return this._source.getNodeData(id);
  }

  *nodes(): IterableIterator<string> {
    for (const id of this._source.nodes()) {
      if (this._nodeFilter(id)) yield id;
    }
  }

  order(): number {
    let count = 0;
    for (const _ of this.nodes()) count++;
    return count;
  }

  neighbors(id: string): string[] {
    if (!this.hasNode(id)) throw new Error(`Node '${id}' not in subgraph view`);
    return this._source.neighbors(id).filter(
      nbr => this._nodeFilter(nbr) && this.hasEdge(id, nbr)
    );
  }

  hasEdge(u: string, v: string, key?: string): boolean {
    if (!this._nodeFilter(u) || !this._nodeFilter(v)) return false;
    if (!this._source.hasEdge(u, v)) return false;

    if (key !== undefined) {
      return this._source.hasEdge(u, v, key) && this._edgeFilter(u, v, key);
    }

    // Check if any edge key passes the filter
    for (const k of this._source.edgeKeys(u, v)) {
      if (this._edgeFilter(u, v, k)) return true;
    }
    return false;
  }

  getEdgeData(u: string, v: string, key?: string): EdgeAttributes {
    if (!this.hasEdge(u, v, key)) throw new Error(`Edge not in subgraph view`);
    return this._source.getEdgeData(u, v, key);
  }

  *edges(): IterableIterator<EdgeTuple> {
    for (const [u, v, key] of this._source.edges()) {
      if (this._nodeFilter(u) && this._nodeFilter(v) && this._edgeFilter(u, v, key)) {
        yield [u, v, key];
      }
    }
  }

  size(): number {
    let count = 0;
    for (const _ of this.edges()) count++;
    return count;
  }
}

/**
 * Create a subgraph view filtered by node IDs.
 */
export function subgraphByNodes(
  graph: CommunicationGraph,
  nodeIds: Set<string>
): SubgraphView {
  return new SubgraphView(graph, id => nodeIds.has(id));
}

/**
 * Create a subgraph view with custom node and edge predicates.
 */
export function subgraphView(
  graph: CommunicationGraph,
  nodeFilter?: (id: string) => boolean,
  edgeFilter?: (u: string, v: string, key: string) => boolean
): SubgraphView {
  return new SubgraphView(graph, nodeFilter, edgeFilter);
}
