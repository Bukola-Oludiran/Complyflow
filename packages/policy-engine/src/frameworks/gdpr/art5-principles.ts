import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingAuditLog } from '../../detections/index.js';

let violationCounter = 0;
const TARGET = ['PHI', 'PII'] as const;

/**
 * GDPR Article 5 — Principles relating to processing of personal data
 *
 * Article 5.1(f): "processed in a manner that ensures appropriate security
 * of the personal data, including protection against unauthorised or unlawful
 * processing and against accidental loss, destruction or damage, using
 * appropriate technical or organisational measures ('integrity and confidentiality')"
 */
export const GdprArt5Principles = defineNode('GdprArt5Principles', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    // Article 5.1(f) — integrity and confidentiality requires audit trails
    const audit = detectMissingAuditLog(event, [...TARGET]);
    if (audit.detected) {
      emit('violation', {
        id: `gdpr-5-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'gdpr-art5-principles',
        framework: 'GDPR',
        ruleId: 'Article 5.1(f)',
        severity: 'high',
        title: 'Personal data processing not audit-logged',
        description: `${audit.detail} GDPR Article 5.1(f) requires processing personal data with appropriate security measures including protection against unauthorised processing.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
