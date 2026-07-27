import { defineNode, useMessage, useEmit, useState } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

const DENIAL_THRESHOLD = 3;

/**
 * HIPAA §164.308(a)(5)(ii)(C) — Log-in Monitoring (ADDRESSABLE)
 *
 * Regulation text: "Procedures for monitoring log-in attempts and
 * reporting discrepancies."
 *
 * This is an Addressable implementation specification under the Security
 * Awareness and Training standard. This policy tracks denied access attempts
 * for PHI resources and flags repeated denials as potential unauthorized
 * access attempts.
 */
export const HipaaPhiLoginMonitoring = defineNode('HipaaPhiLoginMonitoring', () => {
  const emit = useEmit();
  const [denialCounts, setDenialCounts] = useState<Map<string, number>>(new Map());

  useMessage('access-control', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;

    const granted = event.metadata['comply.access.granted'] as boolean | undefined;
    if (granted !== false) return; // only track denied attempts

    const actorKey = event.actor.userId ?? event.actor.service ?? 'unknown';

    setDenialCounts(prev => {
      const updated = new Map(prev);
      const count = (updated.get(actorKey) ?? 0) + 1;
      updated.set(actorKey, count);

      if (count >= DENIAL_THRESHOLD) {
        emit('violation', {
          id: `hipaa-lm-${++violationCounter}`,
          tenantId: event.tenantId,
          policyId: 'hipaa-phi-login-monitoring',
          framework: 'HIPAA',
          ruleId: '164.308(a)(5)(ii)(C)',
          severity: 'medium',
          title: 'Repeated denied access attempts to ePHI resource',
          description: `Actor "${actorKey}" has been denied access to ePHI resource "${event.resource}" ${count} times. §164.308(a)(5)(ii)(C) requires procedures for monitoring log-in attempts and reporting discrepancies. This is an Addressable specification — the organization should assess whether this pattern warrants investigation.`,
          evidence: [event],
          detectedAt: Date.now(),
          resource: event.resource,
          service: event.service,
        } satisfies ComplianceViolation);

        // Reset count after emitting
        updated.set(actorKey, 0);
      }

      return updated;
    });
  });

  return {
    accepts: ['access-control'],
    emits: ['violation'],
  };
});
