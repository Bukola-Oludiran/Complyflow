/**
 * Build-time validation — cycle warnings, permission compatibility checks.
 * Run after graph construction to surface issues before runtime.
 */

import type { CommunicationGraph } from '../graph/graph.js';
import type { NodeInstance } from '../runtime/node-instance.js';
import { hasCycle } from '../algorithms/cycles.js';
import { connectedPairs } from '../algorithms/edges.js';

export interface ValidationWarning {
  level: 'warn' | 'error';
  message: string;
}

/**
 * Validate a graph + node instances for potential issues.
 * Returns a list of warnings/errors (does not throw).
 */
export function validateGraph(
  graph: CommunicationGraph,
  nodes: Map<string, NodeInstance>
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 1. Cycle detection
  if (hasCycle(graph)) {
    warnings.push({
      level: 'warn',
      message: 'Graph contains cycles. Ensure TTL is configured on cyclic edges to prevent infinite message loops.',
    });
  }

  // 2. Permission compatibility between connected nodes
  for (const [u, v] of connectedPairs(graph)) {
    const nodeU = nodes.get(u);
    const nodeV = nodes.get(v);
    if (!nodeU?.manifest || !nodeV?.manifest) continue;

    // Check if u emits anything that v accepts (or vice versa)
    const uToV = nodeU.manifest.emits.some(type => nodeV.manifest!.accepts.includes(type));
    const vToU = nodeV.manifest.emits.some(type => nodeU.manifest!.accepts.includes(type));

    if (!uToV && !vToU) {
      warnings.push({
        level: 'warn',
        message: `Nodes '${u}' and '${v}' are connected but share no compatible message types. ` +
          `'${u}' emits [${nodeU.manifest.emits.join(', ')}], '${v}' accepts [${nodeV.manifest.accepts.join(', ')}]. ` +
          `'${v}' emits [${nodeV.manifest.emits.join(', ')}], '${u}' accepts [${nodeU.manifest.accepts.join(', ')}].`,
      });
    }
  }

  // 3. Isolated nodes (no edges)
  for (const id of graph.nodes()) {
    if (graph.neighbors(id).length === 0) {
      warnings.push({
        level: 'warn',
        message: `Node '${id}' is isolated (no edges). It cannot send or receive messages.`,
      });
    }
  }

  return warnings;
}
