import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(d) — Person or Entity Authentication (REQUIRED)
 *
 * Regulation text: "Implement procedures to verify that a person or entity
 * seeking access to electronic protected health information is the one claimed."
 *
 * This is a Required standard. The most common technical implementation is
 * multi-factor authentication (MFA). This policy checks access-control events
 * for PHI resources where MFA has not been verified.
 */
export const HipaaPhiPersonAuth = defineNode('HipaaPhiPersonAuth', () => {
  const emit = useEmit();

  useMessage('access-control', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;
    if (!event.metadata['comply.access.granted']) return; // only check granted access

    const mfaVerified = event.metadata['comply.access.mfa_verified'] as boolean | undefined;

    if (!mfaVerified) {
      emit('violation', {
        id: `hipaa-pa-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-person-auth',
        framework: 'HIPAA',
        ruleId: '164.312(d)',
        severity: 'critical',
        title: 'ePHI access granted without person authentication verification',
        description: `Access to ePHI resource "${event.resource}" was granted to "${event.actor.userId ?? 'unknown'}" without multi-factor authentication verification. §164.312(d) requires implementing procedures to verify that a person seeking access to ePHI is the one claimed. This is a Required standard.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return {
    accepts: ['access-control'],
    emits: ['violation'],
  };
});
