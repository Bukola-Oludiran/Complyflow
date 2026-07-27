import type { ComplianceEvent, ComplianceEventType, DataClassification, EncryptionState } from '@complyflow/shared';
import {
  COMPLY_EVENT_TYPE,
  COMPLY_SERVICE,
  COMPLY_RESOURCE,
  COMPLY_ACTION,
  COMPLY_ACTOR_USER_ID,
  COMPLY_ACTOR_ROLE,
  COMPLY_ACTOR_SERVICE,
  COMPLY_DATA_CLASS,
  COMPLY_ENCRYPTION_STATE,
  COMPLY_TENANT_ID,
} from '@complyflow/shared';
import type { OtlpSpan, OtlpKeyValue, OtlpResource } from './otlp-types.js';

/**
 * Extract a typed attribute value from an OTLP key-value array.
 */
function getAttr(attrs: OtlpKeyValue[] | undefined, key: string): string | boolean | number | undefined {
  if (!attrs) return undefined;
  const kv = attrs.find(a => a.key === key);
  if (!kv) return undefined;
  if (kv.value.stringValue !== undefined) return kv.value.stringValue;
  if (kv.value.boolValue !== undefined) return kv.value.boolValue;
  if (kv.value.intValue !== undefined) return Number(kv.value.intValue);
  if (kv.value.doubleValue !== undefined) return kv.value.doubleValue;
  return undefined;
}

/**
 * Keys that are already extracted into dedicated ComplianceEvent fields.
 * All other attributes (including unmapped comply.* keys such as
 * comply.flow.from, comply.access.record_count) go into metadata so policy
 * nodes can read them.
 */
const EXTRACTED_KEYS = new Set<string>([
  COMPLY_EVENT_TYPE,
  COMPLY_SERVICE,
  COMPLY_RESOURCE,
  COMPLY_ACTION,
  COMPLY_ACTOR_USER_ID,
  COMPLY_ACTOR_ROLE,
  COMPLY_ACTOR_SERVICE,
  COMPLY_DATA_CLASS,
  COMPLY_ENCRYPTION_STATE,
  COMPLY_TENANT_ID,
]);

/**
 * Collect all attributes that aren't already represented in the top-level
 * ComplianceEvent fields into metadata.
 */
function extractMetadata(attrs: OtlpKeyValue[] | undefined): Record<string, unknown> {
  if (!attrs) return {};
  const metadata: Record<string, unknown> = {};
  for (const kv of attrs) {
    if (!EXTRACTED_KEYS.has(kv.key)) {
      metadata[kv.key] = getAttr([kv], kv.key);
    }
  }
  return metadata;
}

const VALID_EVENT_TYPES = new Set<string>(['data-access', 'access-control', 'data-flow', 'encryption', 'audit-log']);

/**
 * Transform an OTLP span into a ComplianceEvent.
 * Returns null if the span doesn't have the required comply.* attributes.
 */
export function spanToComplianceEvent(
  span: OtlpSpan,
  resource: OtlpResource | undefined,
  tenantIdOverride?: string,
): ComplianceEvent | null {
  const allAttrs = span.attributes;
  const resourceAttrs = resource?.attributes;

  const eventType = getAttr(allAttrs, COMPLY_EVENT_TYPE) as string | undefined;
  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    return null; // Not a compliance span
  }

  const tenantId = tenantIdOverride
    ?? getAttr(allAttrs, COMPLY_TENANT_ID) as string | undefined
    ?? getAttr(resourceAttrs, COMPLY_TENANT_ID) as string | undefined;

  if (!tenantId) {
    return null; // No tenant context
  }

  const service = (getAttr(allAttrs, COMPLY_SERVICE) as string | undefined)
    ?? (getAttr(resourceAttrs, 'service.name') as string | undefined)
    ?? 'unknown';

  return {
    tenantId,
    traceId: span.traceId,
    spanId: span.spanId,
    timestamp: Number(BigInt(span.startTimeUnixNano) / 1_000_000n),
    eventType: eventType as ComplianceEventType,
    service,
    resource: (getAttr(allAttrs, COMPLY_RESOURCE) as string | undefined) ?? '',
    action: (getAttr(allAttrs, COMPLY_ACTION) as string | undefined) ?? '',
    actor: {
      userId: getAttr(allAttrs, COMPLY_ACTOR_USER_ID) as string | undefined,
      role: getAttr(allAttrs, COMPLY_ACTOR_ROLE) as string | undefined,
      service: getAttr(allAttrs, COMPLY_ACTOR_SERVICE) as string | undefined,
    },
    dataClassification: getAttr(allAttrs, COMPLY_DATA_CLASS) as DataClassification | undefined,
    encryptionState: getAttr(allAttrs, COMPLY_ENCRYPTION_STATE) as EncryptionState | undefined,
    metadata: extractMetadata(allAttrs),
  };
}
