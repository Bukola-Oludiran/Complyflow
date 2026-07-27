import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectPlaintextInTransit } from '../../detections/index.js';

let violationCounter = 0;
const TARGET = ['PHI', 'PII', 'PCI', 'internal'] as const;

/**
 * SOC 2 CC6.7 — Restriction of Data Transmission
 *
 * "The entity restricts the transmission, movement, and removal of
 * information to authorized internal and external users and processes,
 * and protects it during transmission."
 */
export const Soc2CC6Transmission = defineNode('Soc2CC6Transmission', () => {
  const emit = useEmit();

  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const result = detectPlaintextInTransit(event, [...TARGET]);
    if (result.detected) {
      emit('violation', {
        id: `soc2-cc67-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'soc2-cc6-transmission',
        framework: 'SOC2',
        ruleId: 'CC6.7',
        severity: 'high',
        title: 'Data transmitted without encryption',
        description: `${result.detail} SOC 2 CC6.7 requires protecting information during transmission.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-flow'], emits: ['violation'] };
});
