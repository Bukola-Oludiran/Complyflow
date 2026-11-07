/**
 * GraphDirectory — lightweight structural summary of the graph.
 *
 * One instance shared by reference across all nodes via ctx.directory.
 * Provides O(1) lookups by ID, role, and depth. Enables node discovery
 * without exposing the full graph topology.
 *
 * ~80 bytes per node. Incrementally updated on addNodeAtRuntime/removeNodeAtRuntime.
 */

import type { CommunicationGraph } from '../graph/graph.js';

export interface DirectoryEntry {
  /** Node ID */
  id: string;
  /** Component/role name (from the defineNode name) */
  role: string;
  /** Depth in the hierarchy (0 = root) */
  depth: number;
  /** Ancestry chain from root to this node */
  path: string[];
}

export class GraphDirectory {
  /** All entries by node ID */
  entries: Map<string, DirectoryEntry>;
  /** Index: role → node IDs */
  byRole: Map<string, string[]>;
  /** Index: depth → node IDs */
  byDepth: Map<number, string[]>;

  constructor() {
    this.entries = new Map();
    this.byRole = new Map();
    this.byDepth = new Map();
  }

  findById(id: string): DirectoryEntry | undefined {
    return this.entries.get(id);
  }

  findByRole(role: string): string[] {
    return this.byRole.get(role) ?? [];
  }

  findByDepth(depth: number): string[] {
    return this.byDepth.get(depth) ?? [];
  }

  /**
   * Find all nodes in the subtree rooted at `ancestorId`.
   * A node is in the subtree if its path contains the ancestor.
   */
  findInSubtree(ancestorId: string): string[] {
    const result: string[] = [];
    for (const [id, entry] of this.entries) {
      if (entry.path.includes(ancestorId)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Check if `ancestorId` is an ancestor of `descendantId`.
   * O(1) — prefix check on the path array.
   */
  isAncestor(ancestorId: string, descendantId: string): boolean {
    const descendant = this.entries.get(descendantId);
    if (!descendant) return false;
    const ancestorIdx = descendant.path.indexOf(ancestorId);
    const descendantIdx = descendant.path.indexOf(descendantId);
    return ancestorIdx !== -1 && ancestorIdx < descendantIdx;
  }

  /** Add an entry and update indexes */
  addEntry(entry: DirectoryEntry): void {
    this.entries.set(entry.id, entry);

    if (!this.byRole.has(entry.role)) {
      this.byRole.set(entry.role, []);
    }
    this.byRole.get(entry.role)!.push(entry.id);

    if (!this.byDepth.has(entry.depth)) {
      this.byDepth.set(entry.depth, []);
    }
    this.byDepth.get(entry.depth)!.push(entry.id);
  }

  /** Remove an entry and update indexes */
  removeEntry(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    this.entries.delete(id);

    const roleList = this.byRole.get(entry.role);
    if (roleList) {
      const idx = roleList.indexOf(id);
      if (idx !== -1) roleList.splice(idx, 1);
      if (roleList.length === 0) this.byRole.delete(entry.role);
    }

    const depthList = this.byDepth.get(entry.depth);
    if (depthList) {
      const idx = depthList.indexOf(id);
      if (idx !== -1) depthList.splice(idx, 1);
      if (depthList.length === 0) this.byDepth.delete(entry.depth);
    }
  }
}

/**
 * Build a directory from the graph and node instances.
 *
 * Depth and path are determined by:
 * 1. Node attributes `_depth` and `_parentPath` (set by the compiler from .grx nesting)
 * 2. If not available, computed via BFS from root nodes (nodes with no nesting parent)
 */
export function buildDirectory(
  graph: CommunicationGraph,
  nodes: Map<string, { id: string; definition: { name: string }; props: Record<string, unknown> }>
): GraphDirectory {
  const directory = new GraphDirectory();

  for (const [id, instance] of nodes) {
    const nodeData = graph.hasNode(id) ? graph.getNodeData(id) : {};

    const role = instance.definition.name;
    const depth = (nodeData._depth as number) ?? 0;
    const path = (nodeData._parentPath as string[]) ?? [id];

    directory.addEntry({ id, role, depth, path });
  }

  return directory;
}
