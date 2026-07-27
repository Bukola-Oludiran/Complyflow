import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(e)(2)(ii) — Transmission Encryption (ADDRESSABLE)
 *
 * Regulation text: "Implement a mechanism to encrypt electronic protected
 * health information whenever deemed appropriate."
 *
 * Under the Transmission Security standard (§164.312(e)(1)): "Implement
 * technical security measures to guard against unauthorized access to ePHI
 * being transmitted over an electronic communications network."
 *
 * This is an Addressable implementation specification. The organization must
 * assess whether encryption is reasonable and appropriate for each transmission
 * path, and document alternatives per §164.306(d)(3) if not implemented.
 *
 * This policy checks in-transit encryption (data-flow events).
 * For at-rest encryption, see phi-encryption-at-rest.ts.
 */
export const HipaaPhiEncryptionInTransit = defineNode('HipaaPhiEncryptionInTransit', () => {
  const emit = useEmit();

  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;

    if (event.encryptionState === 'plaintext') {
      emit('violation', {
        id: `hipaa-eit-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-encryption-in-transit',
        framework: 'HIPAA',
        ruleId: '164.312(e)(2)(ii)',
        severity: 'high',
        title: 'ePHI transmitted without encryption',
        description: `ePHI flowing from "${event.metadata['comply.flow.from'] ?? event.service}" to "${event.metadata['comply.flow.to'] ?? 'unknown'}" is not encrypted. §164.312(e)(2)(ii) requires implementing a mechanism to encrypt ePHI whenever deemed appropriate. This is an Addressable specification — the organization must document the assessment and any alternative measures per §164.306(d)(3).`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return {
    accepts: ['data-flow'],
    emits: ['violation'],
  };
});
