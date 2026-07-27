import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectPlaintextAtRest, detectPlaintextInTransit, detectMissingUserId, detectMissingMfa } from '../../detections/index.js';

let violationCounter = 0;
const TARGET = ['PHI', 'PII'] as const; // GDPR scope: personal data

/**
 * GDPR Article 32 — Security of Processing
 *
 * Article 32.1: "the controller and the processor shall implement appropriate
 * technical and organisational measures to ensure a level of security
 * appropriate to the risk, including inter alia as appropriate:
 *   (a) the pseudonymisation and encryption of personal data;
 *   (b) the ability to ensure the ongoing confidentiality... of processing systems"
 */
export const GdprArt32Security = defineNode('GdprArt32Security', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    // Article 32.1(a) — encryption of personal data
    const plaintext = detectPlaintextAtRest(event, [...TARGET]);
    if (plaintext.detected) {
      emit('violation', {
        id: `gdpr-32-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'gdpr-art32-security',
        framework: 'GDPR',
        ruleId: 'Article 32.1(a)',
        severity: 'high',
        title: 'Personal data accessed without encryption',
        description: `${plaintext.detail} GDPR Article 32.1(a) requires encryption of personal data as an appropriate technical measure.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }

    // Article 32.1(b) — confidentiality of processing systems
    const userId = detectMissingUserId(event, [...TARGET]);
    if (userId.detected) {
      emit('violation', {
        id: `gdpr-32-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'gdpr-art32-security',
        framework: 'GDPR',
        ruleId: 'Article 32.1(b)',
        severity: 'high',
        title: 'Personal data accessed without user identification',
        description: `${userId.detail} GDPR Article 32.1(b) requires ensuring the ongoing confidentiality of processing systems.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  useMessage('data-flow', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const transit = detectPlaintextInTransit(event, [...TARGET]);
    if (transit.detected) {
      emit('violation', {
        id: `gdpr-32-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'gdpr-art32-security',
        framework: 'GDPR',
        ruleId: 'Article 32.1(a)',
        severity: 'high',
        title: 'Personal data transmitted without encryption',
        description: `${transit.detail} GDPR Article 32.1(a) requires encryption of personal data during transmission.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access', 'data-flow'], emits: ['violation'] };
});
