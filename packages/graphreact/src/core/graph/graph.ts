/**
 * CommunicationGraph — an undirected MultiGraph for GraphReact.
 *
 * Ported from NetworkX's MultiGraph (networkx/classes/multigraph.py).
 * Uses the dict-of-dicts-of-dicts pattern translated to nested Maps:
 *   _adj: node → neighbor → edgeKey → edgeAttrs
 *
 * Edges are bidirectional by default: _adj[u][v] and _adj[v][u] reference
 * the same edge-key dict (shared reference, as in NetworkX line 533-534).
 */

import type { NodeAttributes, EdgeAttributes, EdgeTuple, TopologyEvent } from '../types.js';

export class CommunicationGraph {
  /** Node ID → node attributes */
  _node: Map<string, NodeAttributes>;

  /** Node ID → (Neighbor ID → (Edge Key → Edge Attributes)) */
  _adj: Map<string, Map<string, Map<string, EdgeAttributes>>>;

  /** Graph-level attributes */
  graph: Record<string, unknown>;

  /** Topology change listeners */
  private _topologyListeners: Set<(event: TopologyEvent) => void>;

  constructor() {
    this._node = new Map();
    this._adj = new Map();
    this.graph = {};
    this._topologyListeners = new Set();
  }

  /** Subscribe to topology change events. Returns an unsubscribe function. */
  onTopologyChange(listener: (event: TopologyEvent) => void): () => void {
    this._topologyListeners.add(listener);
    return () => { this._topologyListeners.delete(listener); };
  }

  /** Fire a topology event to all registered listeners. */
  private _fireTopologyEvent(event: TopologyEvent): void {
    for (const listener of this._topologyListeners) {
      listener(event);
    }
  }

  // ---- Node operations ----

  addNode(id: string, attrs: NodeAttributes = {}): void {
    if (this._node.has(id)) {
      // Merge attributes into existing node (same as NetworkX)
      const existing = this._node.get(id)!;
      Object.assign(existing, attrs);
      return; // No topology event — node already existed
    }
    this._node.set(id, { ...attrs });
    this._adj.set(id, new Map());
    this._fireTopologyEvent({ type: 'node-added', nodeId: id });
  }

  removeNode(id: string): void {
    if (!this._node.has(id)) {
      throw new Error(`Node '${id}' not in graph`);
    }
    // Collect edge info before removal (for topology events)
    const neighbors = this._adj.get(id)!;
    const removedEdges: Array<{ u: string; v: string; key: string }> = [];
    for (const [nbr, keydict] of neighbors) {
      for (const key of keydict.keys()) {
        removedEdges.push({ u: id, v: nbr, key });
      }
    }
    // Remove all edges involving this node
    for (const nbr of neighbors.keys()) {
      if (nbr !== id) {
        this._adj.get(nbr)!.delete(id);
      }
    }
    this._adj.delete(id);
    this._node.delete(id);
    // Fire edge-removed events before node-removed
    for (const edge of removedEdges) {
      this._fireTopologyEvent({ type: 'edge-removed', u: edge.u, v: edge.v, key: edge.key });
    }
    this._fireTopologyEvent({ type: 'node-removed', nodeId: id });
  }

  hasNode(id: string): boolean {
    return this._node.has(id);
  }

  getNodeData(id: string): NodeAttributes {
    const data = this._node.get(id);
    if (data === undefined) {
      throw new Error(`Node '${id}' not in graph`);
    }
    return data;
  }

  /** Replace ALL attributes on an existing node. Throws if node doesn't exist. */
  setNodeData(id: string, attrs: NodeAttributes): void {
    if (!this._node.has(id)) {
      throw new Error(`Node '${id}' not in graph`);
    }
    this._node.set(id, { ...attrs });
  }

  /** Number of nodes */
  order(): number {
    return this._node.size;
  }

  /** Iterate over node IDs */
  *nodes(): IterableIterator<string> {
    yield* this._node.keys();
  }

  // ---- Edge operations (MultiGraph) ----

  /**
   * Generate a new unused edge key for the pair (u, v).
   * Ported from NetworkX MultiGraph.new_edge_key().
   */
  private newEdgeKey(u: string, v: string): string {
    const keydict = this._adj.get(u)?.get(v);
    if (!keydict) return '0';
    let key = keydict.size;
    while (keydict.has(String(key))) {
      key++;
    }
    return String(key);
  }

  /**
   * Add an edge between u and v. Nodes are auto-created if missing.
   * Returns the assigned edge key.
   *
   * Ported from NetworkX MultiGraph.add_edge() (multigraph.py:508-536).
   */
  addEdge(u: string, v: string, key?: string, attrs: EdgeAttributes = {}): string {
    // Auto-add nodes
    if (!this._adj.has(u)) {
      this._adj.set(u, new Map());
      this._node.set(u, {});
      this._fireTopologyEvent({ type: 'node-added', nodeId: u });
    }
    if (!this._adj.has(v)) {
      this._adj.set(v, new Map());
      this._node.set(v, {});
      this._fireTopologyEvent({ type: 'node-added', nodeId: v });
    }

    if (key === undefined) {
      key = this.newEdgeKey(u, v);
    }

    const uAdj = this._adj.get(u)!;
    const vAdj = this._adj.get(v)!;

    if (uAdj.has(v)) {
      // Existing neighbor: update or add edge key
      const keydict = uAdj.get(v)!;
      const existing = keydict.get(key);
      if (existing) {
        Object.assign(existing, attrs);
        this._fireTopologyEvent({ type: 'edge-updated', u, v, key });
      } else {
        keydict.set(key, { ...attrs });
        this._fireTopologyEvent({ type: 'edge-added', u, v, key });
      }
    } else {
      // New neighbor: create shared keydict (bidirectional)
      const keydict = new Map<string, EdgeAttributes>();
      keydict.set(key, { ...attrs });
      uAdj.set(v, keydict);
      // Share the same Map reference for bidirectionality (NetworkX pattern)
      if (u !== v) {
        vAdj.set(u, keydict);
      }
      this._fireTopologyEvent({ type: 'edge-added', u, v, key });
    }

    return key;
  }

  /**
   * Merge attributes into an existing edge. Throws if the edge doesn't exist.
   * Does NOT auto-create nodes (unlike addEdge).
   * If key is omitted, updates the first edge between u and v.
   */
  updateEdge(u: string, v: string, key?: string, attrs: EdgeAttributes = {}): void {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) {
      throw new Error(`Edge (${u}, ${v}) not in graph`);
    }
    const keydict = uAdj.get(v)!;

    let resolvedKey: string;
    if (key !== undefined) {
      if (!keydict.has(key)) {
        throw new Error(`Edge (${u}, ${v}, ${key}) not in graph`);
      }
      resolvedKey = key;
    } else {
      const firstKey = keydict.keys().next();
      if (firstKey.done) {
        throw new Error(`Edge (${u}, ${v}) has no edges`);
      }
      resolvedKey = firstKey.value;
    }

    const existing = keydict.get(resolvedKey)!;
    Object.assign(existing, attrs);
    this._fireTopologyEvent({ type: 'edge-updated', u, v, key: resolvedKey });
  }

  /**
   * Replace ALL attributes on an existing edge. Throws if the edge doesn't exist.
   * Does NOT auto-create nodes. If key is omitted, replaces data on the first edge.
   */
  setEdgeData(u: string, v: string, key?: string, attrs: EdgeAttributes = {}): void {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) {
      throw new Error(`Edge (${u}, ${v}) not in graph`);
    }
    const keydict = uAdj.get(v)!;

    let resolvedKey: string;
    if (key !== undefined) {
      if (!keydict.has(key)) {
        throw new Error(`Edge (${u}, ${v}, ${key}) not in graph`);
      }
      resolvedKey = key;
    } else {
      const firstKey = keydict.keys().next();
      if (firstKey.done) {
        throw new Error(`Edge (${u}, ${v}) has no edges`);
      }
      resolvedKey = firstKey.value;
    }

    keydict.set(resolvedKey, { ...attrs });
    this._fireTopologyEvent({ type: 'edge-updated', u, v, key: resolvedKey });
  }

  /**
   * Remove an edge. If key is provided, remove only that edge.
   * If key is omitted, remove all edges between u and v.
   */
  removeEdge(u: string, v: string, key?: string): void {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) {
      throw new Error(`Edge (${u}, ${v}) not in graph`);
    }

    const keydict = uAdj.get(v)!;

    if (key !== undefined) {
      if (!keydict.has(key)) {
        throw new Error(`Edge (${u}, ${v}, ${key}) not in graph`);
      }
      keydict.delete(key);
      // If no more edges between u and v, remove neighbor entry
      if (keydict.size === 0) {
        uAdj.delete(v);
        if (u !== v) {
          this._adj.get(v)!.delete(u);
        }
      }
      this._fireTopologyEvent({ type: 'edge-removed', u, v, key });
    } else {
      // Collect keys before removal
      const keys = [...keydict.keys()];
      // Remove all edges between u and v
      uAdj.delete(v);
      if (u !== v) {
        this._adj.get(v)!.delete(u);
      }
      for (const k of keys) {
        this._fireTopologyEvent({ type: 'edge-removed', u, v, key: k });
      }
    }
  }

  hasEdge(u: string, v: string, key?: string): boolean {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) return false;
    if (key !== undefined) {
      return uAdj.get(v)!.has(key);
    }
    return true;
  }

  getEdgeData(u: string, v: string, key?: string): EdgeAttributes {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) {
      throw new Error(`Edge (${u}, ${v}) not in graph`);
    }
    const keydict = uAdj.get(v)!;
    if (key !== undefined) {
      const data = keydict.get(key);
      if (!data) throw new Error(`Edge (${u}, ${v}, ${key}) not in graph`);
      return data;
    }
    // Return first edge's data if no key specified
    const first = keydict.values().next();
    if (first.done) throw new Error(`Edge (${u}, ${v}) has no edges`);
    return first.value;
  }

  /** Get all edge keys between u and v */
  edgeKeys(u: string, v: string): string[] {
    const uAdj = this._adj.get(u);
    if (!uAdj || !uAdj.has(v)) return [];
    return [...uAdj.get(v)!.keys()];
  }

  // ---- Neighbor / degree operations ----

  neighbors(id: string): string[] {
    const adj = this._adj.get(id);
    if (!adj) throw new Error(`Node '${id}' not in graph`);
    return [...adj.keys()];
  }

  /**
   * Degree of a node (number of edges, counting multi-edges).
   * Self-loops count once per edge key.
   */
  degree(id: string): number {
    const adj = this._adj.get(id);
    if (!adj) throw new Error(`Node '${id}' not in graph`);
    let deg = 0;
    for (const [nbr, keydict] of adj) {
      deg += keydict.size;
      // Self-loops are only stored once in adj, but each key counts
      if (nbr === id) {
        deg += keydict.size;
      }
    }
    return deg;
  }

  // ---- Iteration ----

  /** Number of edges (counting multi-edges) */
  size(): number {
    let s = 0;
    const seen = new Set<string>();
    for (const [u, neighbors] of this._adj) {
      for (const [v, keydict] of neighbors) {
        // Each undirected edge appears in both _adj[u][v] and _adj[v][u].
        // Only count once using a canonical ordering.
        const edgeId = u <= v ? `${u}|${v}` : `${v}|${u}`;
        if (!seen.has(edgeId)) {
          seen.add(edgeId);
          s += keydict.size;
        }
      }
    }
    return s;
  }

  /**
   * Iterate over all edges as [u, v, key] tuples.
   * Each undirected edge is yielded once (not twice).
   */
  *edges(): IterableIterator<EdgeTuple> {
    const seen = new Set<string>();
    for (const [u, neighbors] of this._adj) {
      for (const [v, keydict] of neighbors) {
        for (const key of keydict.keys()) {
          const canonical = u <= v ? `${u}|${v}|${key}` : `${v}|${u}|${key}`;
          if (!seen.has(canonical)) {
            seen.add(canonical);
            yield [u, v, key];
          }
        }
      }
    }
  }

  /**
   * Iterate over all edges of a specific node as [u, v, key] tuples.
   */
  *edgesOf(id: string): IterableIterator<EdgeTuple> {
    const adj = this._adj.get(id);
    if (!adj) throw new Error(`Node '${id}' not in graph`);
    for (const [nbr, keydict] of adj) {
      for (const key of keydict.keys()) {
        yield [id, nbr, key];
      }
    }
  }

  // ---- Copy ----

  /** Create a shallow copy of the graph */
  copy(): CommunicationGraph {
    const g = new CommunicationGraph();
    g.graph = { ...this.graph };
    for (const [id, attrs] of this._node) {
      g.addNode(id, { ...attrs });
    }
    for (const [u, v, key] of this.edges()) {
      g.addEdge(u, v, key, { ...this.getEdgeData(u, v, key) });
    }
    return g;
  }
}
