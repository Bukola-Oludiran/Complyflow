import type { ComplianceEvent, DataClassification } from '@complyflow/shared';

export interface DetectionResult {
  detected: boolean;
  detail: string;
}

/**
 * Shared, framework-agnostic detection functions.
 *
 * Each function checks a single compliance condition against a ComplianceEvent.
 * Policy nodes call these and wrap the result in framework-specific violation metadata.
 * The `targetClassifications` parameter controls which data types each framework cares about:
 *   HIPAA → ['PHI']
 *   GDPR → ['PHI', 'PII']
 *   PCI-DSS → ['PCI']
 *   SOC 2 → ['PHI', 'PII', 'PCI', 'internal']
 */

export function isTargetData(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): boolean {
  return !!event.dataClassification && targetClassifications.includes(event.dataClassification);
}

export function detectMissingUserId(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  if (!event.actor.userId) {
    return {
      detected: true,
      detail: `Service "${event.service}" accessed ${event.dataClassification} resource "${event.resource}" without a unique user identifier.`,
    };
  }
  return { detected: false, detail: '' };
}

export function detectMissingRole(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  if (event.actor.userId && !event.actor.role) {
    return {
      detected: true,
      detail: `User "${event.actor.userId}" accessed ${event.dataClassification} resource "${event.resource}" without a defined role.`,
    };
  }
  return { detected: false, detail: '' };
}

export function detectMissingAuditLog(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  if (!event.metadata.auditLogged) {
    return {
      detected: true,
      detail: `Access to ${event.dataClassification} resource "${event.resource}" by ${event.actor.userId ?? 'unknown'} in service "${event.service}" was not audit-logged.`,
    };
  }
  return { detected: false, detail: '' };
}

export function detectPlaintextAtRest(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  if (event.encryptionState === 'plaintext') {
    return {
      detected: true,
      detail: `${event.dataClassification} resource "${event.resource}" was accessed in plaintext by service "${event.service}".`,
    };
  }
  return { detected: false, detail: '' };
}

export function detectPlaintextInTransit(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  if (event.encryptionState === 'plaintext') {
    const from = (event.metadata['comply.flow.from'] as string) ?? event.service;
    const to = (event.metadata['comply.flow.to'] as string) ?? 'unknown';
    return {
      detected: true,
      detail: `${event.dataClassification} data flowing from "${from}" to "${to}" is not encrypted.`,
    };
  }
  return { detected: false, detail: '' };
}

export function detectMissingMfa(
  event: ComplianceEvent,
  targetClassifications: DataClassification[],
): DetectionResult {
  if (!isTargetData(event, targetClassifications)) {
    return { detected: false, detail: '' };
  }
  const granted = event.metadata['comply.access.granted'] as boolean | undefined;
  if (granted === false) return { detected: false, detail: '' };

  const mfaVerified = event.metadata['comply.access.mfa_verified'] as boolean | undefined;
  if (!mfaVerified) {
    return {
      detected: true,
      detail: `Access to ${event.dataClassification} resource "${event.resource}" was granted to "${event.actor.userId ?? 'unknown'}" without MFA verification.`,
    };
  }
  return { detected: false, detail: '' };
}
