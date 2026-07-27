import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingAuditLog } from '../../detections/index.js';

let violationCounter = 0;

/**
 * PCI DSS 4.0.1 Requirement 10 — Log and Monitor All Access to System Components and Cardholder Data
 *
 * Req 10.2: "Audit logs are implemented to support the detection of anomalies
 * and suspicious activity, and the forensic analysis of events."
 */
export const PciReq10Logging = defineNode('PciReq10Logging', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const result = detectMissingAuditLog(event, ['PCI']);
    if (result.detected) {
      emit('violation', {
        id: `pci-r10-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'pci-req10-logging',
        framework: 'PCI-DSS',
        ruleId: 'Req 10.2',
        severity: 'critical',
        title: 'Cardholder data access not audit-logged',
        description: `${result.detail} PCI DSS Requirement 10.2 requires audit logs for detecting anomalies and forensic analysis.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
