import { defineNode, useMessage, useEmit, useGraphQuery, useSource } from 'graphreact';
import { timerSource } from 'graphreact';
import { isServiceNode } from './service-node.js';
import { isResourceNode } from './resource-node.js';

export const DEFAULT_STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * EdgeAgingScanner — periodically scans topology edges and flags stale ones.
 *
 * A topology edge is "stale" if its lastSeen timestamp is older than the
 * configured threshold. Stale edges may indicate that a data flow no longer
 * exists, and compliance checks based on it may be outdated.
 */
export const EdgeAgingScanner = defineNode('EdgeAgingScanner', (ctx) => {
  const emit = useEmit();
  const intervalMs = (ctx.props.intervalMs as number) ?? 60_000;
  const staleThresholdMs = (ctx.props.staleThresholdMs as number) ?? DEFAULT_STALE_THRESHOLD_MS;

  useSource(() => timerSource(intervalMs), [intervalMs]);

  // Hoist useGraphQuery to the component body — GraphReact's hook rules forbid
  // calling hooks inside async/message-handler callbacks. The graph reference is
  // live (the runtime mutates it in place), so reading .edges() inside the tick
  // handler still returns the current edges, not a snapshot at registration time.
  // Mirrors the correct pattern used in ingress-node.ts.
  const graph = useGraphQuery((g) => g, []);

  useMessage('tick', () => {
    const now = Date.now();
    const staleEdges: Array<{ source: string; target: string; key: string; lastSeen: number }> = [];

    for (const [u, v, key] of graph.edges()) {
      // Only scan topology edges (between service/resource nodes)
      if (!isServiceNode(u) && !isResourceNode(u)) continue;
      if (!isServiceNode(v) && !isResourceNode(v)) continue;

      const data = graph.getEdgeData(u, v, key);
      const lastSeen = data.lastSeen as number | undefined;
      if (lastSeen && (now - lastSeen) > staleThresholdMs) {
        staleEdges.push({ source: u, target: v, key, lastSeen });
      }
    }

    if (staleEdges.length > 0) {
      emit('stale-edges', {
        count: staleEdges.length,
        edges: staleEdges,
        threshold: staleThresholdMs,
        scannedAt: now,
      });
    }
  });

  return {
    accepts: ['tick'],
    emits: ['stale-edges'],
  };
});
