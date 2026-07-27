import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

let violationCounter = 0;

/**
 * HIPAA §164.312(a)(2)(iv) — Encryption and Decryption (ADDRESSABLE)
 *
 * Regulation text: "Implement a mechanism to encrypt and decrypt electronic
 * protected health information."
 *
 * This is an Addressable implementation specification. If encryption is not
 * implemented, the organization must document why it is not reasonable and
 * appropriate, and implement an equivalent alternative measure per §164.306(d)(3).
 *
 * This policy checks at-rest encryption (data-access events).
 * For transmission encryption, see phi-encryption-in-transit.ts.
 */
export const HipaaPhiEncryptionAtRest = defineNode('HipaaPhiEncryptionAtRest', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;
    if (event.dataClassification !== 'PHI') return;

    if (event.encryptionState === 'plaintext') {
      emit('violation', {
        id: `hipaa-ear-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'hipaa-phi-encryption-at-rest',
        framework: 'HIPAA',
        ruleId: '164.312(a)(2)(iv)',
        severity: 'high',
        title: 'ePHI accessed without encryption',
        description: `ePHI resource "${event.resource}" was accessed in plaintext by service "${event.service}". §164.312(a)(2)(iv) requires implementing a mechanism to encrypt and decrypt ePHI. This is an Addressable specification — if encryption is not implemented, the organization must document why and implement an equivalent alternative measure per §164.306(d)(3).`,
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
