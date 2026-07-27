import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectPlaintextInTransit } from '../../detections/index.js';

let violationCounter = 0;

/**
 * PCI DSS 4.0.1 Requirement 4 — Protect Cardholder Data with Strong Cryptography During Transmission
 *
 * Req 4.2.1: "Strong cryptography is implemented to safeguard PAN during
 * transmission over open, public networks."
 */
export const PciReq4ProtectTransit = defineNode('PciReq4ProtectTransit', () => {
  const emit = useEmit();

  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const result = detectPlaintextInTransit(event, ['PCI']);
    if (result.detected) {
      emit('violation', {
        id: `pci-r4-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'pci-req4-protect-transit',
        framework: 'PCI-DSS',
        ruleId: 'Req 4.2.1',
        severity: 'critical',
        title: 'Cardholder data transmitted without encryption',
        description: `${result.detail} PCI DSS Requirement 4.2.1 requires strong cryptography to safeguard PAN during transmission.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-flow'], emits: ['violation'] };
});
