import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingAuditLog } from '../../detections/index.js';

let violationCounter = 0;
const TARGET = ['PHI', 'PII', 'PCI', 'internal'] as const;

/**
 * SOC 2 CC7.2 — Monitoring of System Components
 *
 * "The entity monitors system components and the operation of those
 * components for anomalies that are indicative of malicious acts,
 * natural disasters, and errors affecting the entity's ability to
 * meet its objectives."
 */
export const Soc2CC7Monitoring = defineNode('Soc2CC7Monitoring', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const result = detectMissingAuditLog(event, [...TARGET]);
    if (result.detected) {
      emit('violation', {
        id: `soc2-cc72-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'soc2-cc7-monitoring',
        framework: 'SOC2',
        ruleId: 'CC7.2',
        severity: 'high',
        title: 'Data access not monitored',
        description: `${result.detail} SOC 2 CC7.2 requires monitoring system components for anomalies.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
