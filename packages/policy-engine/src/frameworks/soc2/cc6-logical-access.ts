import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingUserId, detectPlaintextAtRest } from '../../detections/index.js';

let violationCounter = 0;
const TARGET = ['PHI', 'PII', 'PCI', 'internal'] as const;

/**
 * SOC 2 CC6.1 — Logical and Physical Access Controls
 *
 * "The entity implements logical access security software, infrastructure,
 * and architectures over protected information assets to protect them from
 * security events to meet the entity's objectives."
 */
export const Soc2CC6LogicalAccess = defineNode('Soc2CC6LogicalAccess', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const userId = detectMissingUserId(event, [...TARGET]);
    if (userId.detected) {
      emit('violation', {
        id: `soc2-cc6-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'soc2-cc6-logical-access',
        framework: 'SOC2',
        ruleId: 'CC6.1',
        severity: 'high',
        title: 'Data accessed without user identification',
        description: `${userId.detail} SOC 2 CC6.1 requires logical access security over protected information assets.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }

    const plaintext = detectPlaintextAtRest(event, [...TARGET]);
    if (plaintext.detected) {
      emit('violation', {
        id: `soc2-cc6-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'soc2-cc6-logical-access',
        framework: 'SOC2',
        ruleId: 'CC6.1',
        severity: 'high',
        title: 'Protected data accessed without encryption',
        description: `${plaintext.detail} SOC 2 CC6.1 requires protecting information assets from security events.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
