import { defineNode, useEmit, useState, useGraphQuery, useTopology } from 'graphreact';
import type { ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

const BROAD_ACCESS_THRESHOLD = 3;

/**
 * HIPAA §164.502(b) — Minimum Necessary (PRIVACY RULE)
 *
 * Regulation text: "When using or disclosing protected health information...
 * a covered entity... must make reasonable efforts to limit protected health
 * information to the minimum necessary to accomplish the intended purpose."
 *
 * This is a topology-aware policy that analyzes the discovered system map
 * to detect services with unusually broad PHI access patterns. A service
 * accessing many distinct PHI resources may be violating the minimum
 * necessary principle.
 *
 * This is a heuristic — the "minimum necessary" depends on business context
 * that cannot be determined from telemetry alone.
 */
export const HipaaPhiMinimumNecessary = defineNode('HipaaPhiMinimumNecessary', () => {
  const emit = useEmit();
  const [topologyVersion, setTopologyVersion] = useState(0);

  useTopology(() => {
    setTopologyVersion(v => v + 1);
  }, { types: ['edge-added', 'node-added', 'edge-updated'] });

  const findings = useGraphQuery((graph) => {
    const violations: Partial<ComplianceViolation>[] = [];

    for (const nodeId of graph.nodes()) {
      const data = graph.getNodeData(nodeId);
      if (data.nodeType !== 'service') continue;

      // Count distinct PHI resources this service accesses
      const phiResources: string[] = [];
      for (const neighborId of graph.neighbors(nodeId)) {
        const neighborData = graph.getNodeData(neighborId);
        if (neighborData.nodeType !== 'resource') continue;

        const classifications = neighborData.dataClassifications as string[] | undefined;
        if (classifications?.includes('PHI')) {
          phiResources.push(neighborId);
        }
      }

      if (phiResources.length >= BROAD_ACCESS_THRESHOLD) {
        violations.push({
          policyId: 'hipaa-phi-minimum-necessary',
          framework: 'HIPAA',
          ruleId: '164.502(b)',
          severity: 'medium',
          title: 'Service has broad ePHI access pattern',
          description: `Service "${data.serviceName}" accesses ${phiResources.length} distinct PHI resources: ${phiResources.join(', ')}. §164.502(b) requires making reasonable efforts to limit PHI to the minimum necessary to accomplish the intended purpose. Review whether this service requires access to all these resources.`,
          resource: phiResources[0],
          service: nodeId,
        });
      }
    }

    return violations;
  }, [topologyVersion]);

  if (findings && findings.length > 0) {
    for (const finding of findings) {
      emit('violation', {
        id: `hipaa-mn-${++violationCounter}`,
        tenantId: '',
        detectedAt: Date.now(),
        evidence: [],
        ...finding,
      } as ComplianceViolation);
    }
  }

  return {
    accepts: [],
    emits: ['violation'],
  };
});
