import { defineNode, useMessage, useEmit, useGraphQuery } from 'graphreact';
import type { ComplianceEvent, TopologyEdgeAttrs } from '@complyflow/shared';
import { makeServiceId, createServiceAttrs, updateServiceAttrs } from './service-node.js';
import { makeResourceId, createResourceAttrs, updateResourceAttrs } from './resource-node.js';

/**
 * IngressNode — entry point for compliance events into the tenant graph.
 *
 * Does two things per event:
 * 1. Forwards the event to downstream policy nodes (Layer 1)
 * 2. Builds/updates the topology graph from observed behavior (Layer 2)
 *
 * Topology building:
 * - data-access events → create service→resource edges (type: 'accesses')
 * - data-flow events → create service→service edges (type: 'flows-to')
 * - All events update node attributes (lastSeen, eventCount, classifications)
 */
export const IngressNode = defineNode('IngressNode', () => {
  const emit = useEmit();
  const graph = useGraphQuery((g) => g, []);

  function ensureServiceNode(serviceName: string, event: ComplianceEvent): string {
    const id = makeServiceId(serviceName);
    if (!graph.hasNode(id)) {
      graph.addNode(id, createServiceAttrs(serviceName, event));
    } else {
      updateServiceAttrs(graph.getNodeData(id), event);
    }
    return id;
  }

  function ensureResourceNode(resourceName: string, event: ComplianceEvent): string {
    const id = makeResourceId(resourceName);
    if (!graph.hasNode(id)) {
      graph.addNode(id, createResourceAttrs(resourceName, event));
    } else {
      updateResourceAttrs(graph.getNodeData(id), event);
    }
    return id;
  }

  function ensureTopologyEdge(
    sourceId: string,
    targetId: string,
    edgeType: 'accesses' | 'flows-to',
    event: ComplianceEvent,
  ): void {
    if (graph.hasEdge(sourceId, targetId)) {
      const existing = graph.getEdgeData(sourceId, targetId);
      // firstSeen always reflects the earliest observed timestamp, regardless
      // of arrival order. lastSeen always reflects the latest.
      const existingFirstSeen = (existing.firstSeen as number | undefined) ?? event.timestamp;
      const existingLastSeen = (existing.lastSeen as number | undefined) ?? event.timestamp;
      graph.updateEdge(sourceId, targetId, undefined, {
        firstSeen: Math.min(existingFirstSeen, event.timestamp),
        lastSeen: Math.max(existingLastSeen, event.timestamp),
        accessCount: ((existing.accessCount as number) || 0) + 1,
        dataClassification: event.dataClassification,
        encryptionState: event.encryptionState,
      } satisfies Partial<TopologyEdgeAttrs>);
    } else {
      graph.addEdge(sourceId, targetId, edgeType, {
        edgeType,
        dataClassification: event.dataClassification,
        encryptionState: event.encryptionState,
        lastSeen: event.timestamp,
        firstSeen: event.timestamp,
        accessCount: 1,
      } satisfies TopologyEdgeAttrs);
    }
  }

  // --- Event handlers: forward + build topology ---

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;
    emit('data-access', event);

    if (event.service && event.resource) {
      const svcId = ensureServiceNode(event.service, event);
      const resId = ensureResourceNode(event.resource, event);
      ensureTopologyEdge(svcId, resId, 'accesses', event);
    }
  });

  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;
    emit('data-flow', event);

    const fromService = (event.metadata['comply.flow.from'] as string) ?? event.service;
    const toService = (event.metadata['comply.flow.to'] as string) ?? '';

    if (fromService && toService) {
      const fromId = ensureServiceNode(fromService, event);
      const toId = ensureServiceNode(toService, event);
      ensureTopologyEdge(fromId, toId, 'flows-to', event);
    }
  });

  useMessage('access-control', (msg) => {
    const event = msg.payload as ComplianceEvent;
    emit('access-control', event);

    if (event.service) {
      ensureServiceNode(event.service, event);
    }
  });

  useMessage('encryption', (msg) => {
    emit('encryption', msg.payload);
  });

  useMessage('audit-log', (msg) => {
    emit('audit-log', msg.payload);
  });

  return {
    accepts: ['data-access', 'access-control', 'data-flow', 'encryption', 'audit-log'],
    emits: ['data-access', 'access-control', 'data-flow', 'encryption', 'audit-log'],
  };
});
