import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectPlaintextAtRest } from '../../detections/index.js';

let violationCounter = 0;

/**
 * PCI DSS 4.0.1 Requirement 3 — Protect Stored Account Data
 *
 * Req 3.5: "Primary account number (PAN) is secured wherever it is stored."
 * Req 3.3.2: "SAD that is stored electronically prior to completion of
 * authorization is encrypted using strong cryptography."
 */
export const PciReq3ProtectStored = defineNode('PciReq3ProtectStored', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const result = detectPlaintextAtRest(event, ['PCI']);
    if (result.detected) {
      emit('violation', {
        id: `pci-r3-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'pci-req3-protect-stored',
        framework: 'PCI-DSS',
        ruleId: 'Req 3.5',
        severity: 'critical',
        title: 'Cardholder data stored without encryption',
        description: `${result.detail} PCI DSS Requirement 3.5 requires securing PAN wherever it is stored using strong cryptography.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
