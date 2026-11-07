/**
 * Permission validation and channel policy resolution.
 *
 * Resolution order:
 * 1. node.manifest.channels[senderId] — exact neighbor match
 * 2. node.manifest.channels['*'] — wildcard default
 * 3. node.manifest.accepts/emits — legacy flat fallback
 * 4. Edge attributes overlay (filter, rateLimit, priority, transform)
 */

import type { ChannelPolicy, IncomingMessage } from '../types.js';
import type { NodeInstance } from './node-instance.js';
import type { CommunicationGraph } from '../graph/graph.js';
import type { GraphReactEdgeAttributes } from '../graph/attributes.js';
import { getTransform } from './transforms.js';

export interface ResolvedPolicy {
  accepts: string[];
  emits: string[];
  transform: ((msg: IncomingMessage) => IncomingMessage | null) | null;
  rateLimit: number | null;
  priority: number;
}

/**
 * Resolve the full channel policy for a sender→target pair.
 * Merges node-level channel policies with edge-level attributes.
 */
export function resolveChannelPolicy(
  targetNode: NodeInstance,
  senderId: string,
  graph: CommunicationGraph,
  edgeKey?: string
): ResolvedPolicy {
  const manifest = targetNode.manifest;
  if (!manifest) {
    return { accepts: [], emits: [], transform: null, rateLimit: null, priority: 0 };
  }

  // Step 1-3: Resolve node-level policy
  let channelPolicy: ChannelPolicy | undefined;

  if (manifest.channels) {
    channelPolicy = manifest.channels[senderId] ?? manifest.channels['*'];
  }

  const accepts = channelPolicy?.accepts ?? manifest.accepts;
  const emits = channelPolicy?.emits ?? manifest.emits;
  let transform = channelPolicy?.transform ?? null;
  let rateLimit = channelPolicy?.rateLimit ?? null;
  let priority = channelPolicy?.priority ?? 0;

  // Step 4: Overlay edge attributes
  if (graph.hasEdge(senderId, targetNode.id)) {
    try {
      if (edgeKey !== undefined) {
        // Specific edge key — use that edge's data
        const edgeData = graph.getEdgeData(senderId, targetNode.id, edgeKey) as GraphReactEdgeAttributes;
        const filteredAccepts = edgeData.filter ? accepts.filter(t => edgeData.filter!.includes(t)) : accepts;
        return {
          accepts: filteredAccepts,
          emits,
          transform: resolveTransform(transform, edgeData),
          rateLimit: edgeData.rateLimit ?? rateLimit,
          priority: edgeData.priority ?? priority,
        };
      }

      // No specific edge key — check ALL edges between the pair.
      // Union all filters across multi-edges (if any edge allows a type, it passes).
      const keys = graph.edgeKeys(senderId, targetNode.id);
      if (keys.length > 0) {
        let hasAnyFilter = false;
        const allowedTypes = new Set<string>();
        let bestTransform = transform;
        let bestRateLimit = rateLimit;
        let bestPriority = priority;

        for (const key of keys) {
          const edgeData = graph.getEdgeData(senderId, targetNode.id, key) as GraphReactEdgeAttributes;
          if (edgeData.filter) {
            hasAnyFilter = true;
            for (const t of edgeData.filter) allowedTypes.add(t);
          }
          if (edgeData.rateLimit !== undefined) bestRateLimit = edgeData.rateLimit;
          if (edgeData.priority !== undefined) bestPriority = Math.max(bestPriority, edgeData.priority);
          if (!bestTransform) bestTransform = resolveTransform(null, edgeData);
        }

        if (hasAnyFilter) {
          const filtered = accepts.filter(t => allowedTypes.has(t));
          return { accepts: filtered, emits, transform: bestTransform, rateLimit: bestRateLimit, priority: bestPriority };
        }

        rateLimit = bestRateLimit;
        priority = bestPriority;
        transform = bestTransform;
      }
    } catch {
      // Edge doesn't exist or no data — use node-level policy only
    }
  }

  return { accepts, emits, transform, rateLimit, priority };
}

/**
 * Resolve transform: node-level function takes precedence over edge-level named transform.
 */
function resolveTransform(
  nodeTransform: ((msg: IncomingMessage) => IncomingMessage | null) | null,
  edgeData: GraphReactEdgeAttributes
): ((msg: IncomingMessage) => IncomingMessage | null) | null {
  // Node-level transform takes precedence
  if (nodeTransform) return nodeTransform;

  // Edge-level named transform
  if (edgeData.transform) {
    const namedFn = getTransform(edgeData.transform);
    if (namedFn) {
      // Wrap to pass edge attrs
      return (msg: IncomingMessage) => namedFn(msg, edgeData);
    }
  }

  return null;
}

// --- Legacy compatibility functions ---

/**
 * Check if a node accepts a given message type (legacy flat check).
 * Used by existing code paths that haven't been updated to use resolveChannelPolicy.
 */
export function nodeAccepts(node: NodeInstance, messageType: string): boolean {
  if (!node.manifest) return false;
  return node.manifest.accepts.includes(messageType);
}

/**
 * Check if a node is allowed to emit a given message type.
 */
export function nodeCanEmit(node: NodeInstance, messageType: string): boolean {
  if (!node.manifest) return false;
  return node.manifest.emits.includes(messageType);
}

/**
 * Check if an edge allows a given message type (via filter attribute).
 * If no filter is set, all types are allowed.
 */
export function edgeAllows(
  graph: CommunicationGraph,
  u: string,
  v: string,
  messageType: string,
  edgeKey?: string
): boolean {
  const data = graph.getEdgeData(u, v, edgeKey) as GraphReactEdgeAttributes;
  if (!data.filter) return true;
  return data.filter.includes(messageType);
}
