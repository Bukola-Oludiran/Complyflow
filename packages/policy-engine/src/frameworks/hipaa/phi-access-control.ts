import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(a)(2)(i) — Unique User Identification (REQUIRED)
 *
 * Regulation text: "Assign a unique name and/or number for identifying
 * and tracking user identity."
 *
 * This is a Required implementation specification under the Access Control
 * standard (§164.312(a)(1)). All ePHI access must be attributable to a
 * uniquely identified user with verified access rights per §164.308(a)(4).
 */
export const HipaaPhiAccessControl = defineNode('HipaaPhiAccessControl', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;

    if (!event.actor.userId) {
      emit('violation', {
        id: `hipaa-ac-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-access-control',
        framework: 'HIPAA',
        ruleId: '164.312(a)(2)(i)',
        severity: 'critical',
        title: 'ePHI accessed without unique user identification',
        description: `Service "${event.service}" accessed ePHI resource "${event.resource}" (action: ${event.action}) without a unique user identifier. §164.312(a)(2)(i) requires assigning a unique name or number for identifying and tracking user identity. This is a Required implementation specification.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }

    if (event.actor.userId && !event.actor.role) {
      emit('violation', {
        id: `hipaa-ac-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-access-control',
        framework: 'HIPAA',
        ruleId: '164.312(a)(2)(i)',
        severity: 'high',
        title: 'ePHI accessed by user without defined role',
        description: `User "${event.actor.userId}" accessed ePHI resource "${event.resource}" without a defined role. Access rights as specified in §164.308(a)(4) cannot be verified without role assignment.`,
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
