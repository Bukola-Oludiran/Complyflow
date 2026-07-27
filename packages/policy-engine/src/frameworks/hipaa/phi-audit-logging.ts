import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(b) — Audit Controls (REQUIRED)
 *
 * Regulation text: "Implement hardware, software, and/or procedural mechanisms
 * that record and examine activity in information systems that contain or use
 * electronic protected health information."
 *
 * This is a Required standard with no sub-specifications. All access to ePHI
 * must be recorded in audit logs.
 */
export const HipaaPhiAuditLogging = defineNode('HipaaPhiAuditLogging', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;

    if (!event.metadata.auditLogged) {
      emit('violation', {
        id: `hipaa-al-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-audit-logging',
        framework: 'HIPAA',
        ruleId: '164.312(b)',
        severity: 'high',
        title: 'ePHI access not audit-logged',
        description: `Access to ePHI resource "${event.resource}" by ${event.actor.userId ?? 'unknown user'} in service "${event.service}" was not recorded in audit logs. §164.312(b) requires implementing mechanisms that record and examine activity in information systems containing ePHI. This is a Required standard.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return {
    accepts: ['data-access'],
    emits: ['violation'],
  };
});
