import { defineNode, useMessage, useEmit, useState, useGraphQuery, useTopology } from 'graphreact';
import { allPaths } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(e)(1) — Transmission Security (Topology-Aware)
 *
 * Layer 2 policy: analyzes the discovered topology graph to detect
 * paths where PHI flows through unencrypted edges.
 *
 * Unlike the stateless phi-encryption policy that checks individual events,
 * this policy checks the STRUCTURE of data flows — "does PHI reach this
 * resource through any unencrypted path?"
 *
 * Triggers:
 * - When new topology edges are added or updated (via useTopology)
 * - When data-flow events arrive (immediate check)
 */
export const HipaaPhiDataFlowPath = defineNode('HipaaPhiDataFlowPath', () => {
  const emit = useEmit();
  const [topologyVersion, setTopologyVersion] = useState(0);

  // React to topology changes
  useTopology(() => {
    setTopologyVersion(v => v + 1);
  }, { types: ['edge-added', 'edge-updated'] });

  // Scan topology for unencrypted PHI paths when topology changes
  const findings = useGraphQuery((graph) => {
    const violations: Partial<ComplianceViolation>[] = [];

    // Find all resource nodes with PHI classification
    const phiResources: string[] = [];
    const serviceNodes: string[] = [];

    for (const nodeId of graph.nodes()) {
      const data = graph.getNodeData(nodeId);
      if (data.nodeType === 'resource') {
        const classifications = data.dataClassifications as string[] | undefined;
        if (classifications?.includes('PHI')) {
          phiResources.push(nodeId);
        }
      } else if (data.nodeType === 'service') {
        serviceNodes.push(nodeId);
      }
    }

    // For each PHI resource, find all service paths to it
    for (const resId of phiResources) {
      for (const svcId of serviceNodes) {
        const paths = allPaths(graph, svcId, resId, { maxDepth: 5 });

        for (const path of paths) {
          // Check each edge on the path for encryption
          for (let i = 0; i < path.length - 1; i++) {
            const edgeData = graph.getEdgeData(path[i], path[i + 1]);
            if (edgeData.encryptionState === 'plaintext') {
              const fromData = graph.getNodeData(path[i]);
              const toData = graph.getNodeData(path[i + 1]);
              violations.push({
                policyId: 'hipaa-phi-data-flow-path',
                framework: 'HIPAA',
                ruleId: '164.312.e.1.topology',
                severity: 'critical',
                title: 'Unencrypted ePHI transmission path detected',
                description: `PHI flows from "${fromData.serviceName ?? fromData.resourceName ?? path[i]}" to "${toData.serviceName ?? toData.resourceName ?? path[i + 1]}" without encryption. Full path: ${path.join(' → ')}`,
                resource: resId,
                service: path[0],
              });
              break; // one violation per path is enough
            }
          }
        }
      }
    }

    return violations;
  }, [topologyVersion]);

  // Emit any findings as violations
  if (findings && findings.length > 0) {
    for (const finding of findings) {
      emit('violation', {
        id: `hipaa-dfp-${++violationCounter}`,
        tenantId: '', // filled by TenantManager
        detectedAt: Date.now(),
        evidence: [],
        ...finding,
      } as ComplianceViolation);
    }
  }

  // Also check individual data-flow events for immediate feedback
  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification === 'PHI' && event.encryptionState === 'plaintext') {
      emit('violation', {
        id: `hipaa-dfp-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-data-flow-path',
        framework: 'HIPAA',
        ruleId: '164.312(e)(2)(ii)',
        severity: 'high',
        title: 'PHI data flow without encryption',
        description: `PHI flows from "${event.metadata['comply.flow.from'] ?? event.service}" to "${event.metadata['comply.flow.to'] ?? 'unknown'}" without encryption.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return {
    accepts: ['data-flow'],
    emits: ['violation'],
  };
});
