import type { ComplianceEvent, ResourceNodeAttrs, DataClassification, EncryptionState } from '@complyflow/shared';

export const RESOURCE_PREFIX = 'res:';

export function makeResourceId(name: string): string {
  return `${RESOURCE_PREFIX}${name}`;
}

export function isResourceNode(id: string): boolean {
  return id.startsWith(RESOURCE_PREFIX);
}

export function createResourceAttrs(name: string, event: ComplianceEvent): ResourceNodeAttrs {
  return {
    nodeType: 'resource',
    resourceName: name,
    dataClassifications: event.dataClassification ? [event.dataClassification] : [],
    encryptionStates: event.encryptionState ? [event.encryptionState] : [],
    lastSeen: event.timestamp,
    accessCount: 1,
  };
}

export function updateResourceAttrs(attrs: Record<string, unknown>, event: ComplianceEvent): void {
  attrs.lastSeen = event.timestamp;
  attrs.accessCount = ((attrs.accessCount as number) || 0) + 1;

  if (event.dataClassification) {
    const classifications = attrs.dataClassifications as DataClassification[];
    if (!classifications.includes(event.dataClassification)) {
      classifications.push(event.dataClassification);
    }
  }
  if (event.encryptionState) {
    const states = attrs.encryptionStates as EncryptionState[];
    if (!states.includes(event.encryptionState)) {
      states.push(event.encryptionState);
    }
  }
}
