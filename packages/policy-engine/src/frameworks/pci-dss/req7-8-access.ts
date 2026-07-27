import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingUserId, detectMissingMfa } from '../../detections/index.js';

let violationCounter = 0;

/**
 * PCI DSS 4.0.1 Requirements 7+8 — Access Control + Authentication
 *
 * Req 7.2: "Access to system components and data is appropriately defined and assigned."
 * Req 8.2: "User identification and related accounts are strictly managed."
 * Req 8.3: "Strong authentication is established and managed."
 */
export const PciReq78Access = defineNode('PciReq78Access', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const userId = detectMissingUserId(event, ['PCI']);
    if (userId.detected) {
      emit('violation', {
        id: `pci-r78-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'pci-req7-8-access',
        framework: 'PCI-DSS',
        ruleId: 'Req 8.2',
        severity: 'critical',
        title: 'Cardholder data accessed without user identification',
        description: `${userId.detail} PCI DSS Requirement 8.2 requires strict management of user identification.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  useMessage('access-control', (msg) => {
    const event = msg.payload as ComplianceEvent;

    const mfa = detectMissingMfa(event, ['PCI']);
    if (mfa.detected) {
      emit('violation', {
        id: `pci-r78-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'pci-req7-8-access',
        framework: 'PCI-DSS',
        ruleId: 'Req 8.3',
        severity: 'critical',
        title: 'Cardholder data access without strong authentication',
        description: `${mfa.detail} PCI DSS Requirement 8.3 requires strong authentication for access to cardholder data.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access', 'access-control'], emits: ['violation'] };
});
