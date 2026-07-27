import { defineNode, useEmit, useState, useGraphQuery, useTopology } from 'graphreact';
import type { ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(b) — Audit Controls (Topology-Aware)
 *
 * Layer 2 policy: analyzes the discovered topology to detect services
 * that access PHI resources without audit logging enabled.
 *
 * Unlike the stateless phi-audit-logging policy that checks individual events,
 * this policy checks the STRUCTURE — "does this service have audit logging
 * enabled given that it accesses PHI?"
 */
export const HipaaPhiAccessScope = defineNode('HipaaPhiAccessScope', () => {
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
      if (data.hasAuditLogging) continue; // compliant

      // Check if this service accesses any PHI resources
      for (const neighborId of graph.neighbors(nodeId)) {
        const neighborData = graph.getNodeData(neighborId);
        if (neighborData.nodeType !== 'resource') continue;

        const classifications = neighborData.dataClassifications as string[] | undefined;
        if (!classifications?.includes('PHI')) continue;

        // This service accesses PHI without audit logging
        violations.push({
          policyId: 'hipaa-phi-access-scope',
          framework: 'HIPAA',
          ruleId: '164.312(b)',
          severity: 'high',
          title: 'Service accesses PHI without audit logging',
          description: `Service "${data.serviceName}" accesses PHI resource "${neighborData.resourceName}" but does not have audit logging enabled.`,
          resource: neighborId,
          service: nodeId,
        });
      }
    }

    return violations;
  }, [topologyVersion]);

  if (findings && findings.length > 0) {
    for (const finding of findings) {
      emit('violation', {
        id: `hipaa-as-${++violationCounter}`,
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
