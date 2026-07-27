import type { ComplianceEvent, ServiceNodeAttrs, DataClassification } from '@complyflow/shared';

export const SERVICE_PREFIX = 'svc:';

export function makeServiceId(name: string): string {
  return `${SERVICE_PREFIX}${name}`;
}

export function isServiceNode(id: string): boolean {
  return id.startsWith(SERVICE_PREFIX);
}

export function createServiceAttrs(name: string, event: ComplianceEvent): ServiceNodeAttrs {
  return {
    nodeType: 'service',
    serviceName: name,
    dataClassifications: event.dataClassification ? [event.dataClassification] : [],
    hasAuditLogging: !!event.metadata.auditLogged,
    lastSeen: event.timestamp,
    eventCount: 1,
  };
}

export function updateServiceAttrs(attrs: Record<string, unknown>, event: ComplianceEvent): void {
  attrs.lastSeen = event.timestamp;
  attrs.eventCount = ((attrs.eventCount as number) || 0) + 1;

  if (event.dataClassification) {
    const classifications = attrs.dataClassifications as DataClassification[];
    if (!classifications.includes(event.dataClassification)) {
      classifications.push(event.dataClassification);
    }
  }
  if (event.metadata.auditLogged) {
    attrs.hasAuditLogging = true;
  }
}
