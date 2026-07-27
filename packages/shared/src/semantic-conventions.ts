/**
 * OTel semantic attribute keys for ComplyFlow compliance events.
 *
 * The SDK sets these on OTel spans. The ingestion layer reads them
 * to construct ComplianceEvent objects. The comply.* namespace avoids
 * conflicts with standard OTel semantic conventions.
 */

export const COMPLY_EVENT_TYPE = 'comply.event_type';
export const COMPLY_SERVICE = 'comply.service';
export const COMPLY_RESOURCE = 'comply.resource';
export const COMPLY_ACTION = 'comply.action';
export const COMPLY_ACTOR_USER_ID = 'comply.actor.user_id';
export const COMPLY_ACTOR_ROLE = 'comply.actor.role';
export const COMPLY_ACTOR_SERVICE = 'comply.actor.service';
export const COMPLY_DATA_CLASS = 'comply.data_class';
export const COMPLY_ENCRYPTION_STATE = 'comply.encryption_state';
export const COMPLY_TENANT_ID = 'comply.tenant_id';

// Data flow specific
export const COMPLY_FLOW_FROM = 'comply.flow.from';
export const COMPLY_FLOW_TO = 'comply.flow.to';
export const COMPLY_FLOW_TRANSFORMED = 'comply.flow.transformed';
export const COMPLY_FLOW_TRANSFORMATION_TYPE = 'comply.flow.transformation_type';

// Access control specific
export const COMPLY_ACCESS_GRANTED = 'comply.access.granted';
export const COMPLY_ACCESS_METHOD = 'comply.access.method';
export const COMPLY_ACCESS_MFA_VERIFIED = 'comply.access.mfa_verified';
export const COMPLY_ACCESS_DATA_CLASS = 'comply.access.data_class';

// Bulk operation semantics (for data-access events)
export const COMPLY_ACCESS_RECORD_COUNT = 'comply.access.record_count';
export const COMPLY_ACCESS_BATCH_REASON = 'comply.access.batch_reason';

/** All comply.* attribute keys for validation */
export const ALL_COMPLY_ATTRIBUTES = [
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
  COMPLY_FLOW_FROM,
  COMPLY_FLOW_TO,
  COMPLY_FLOW_TRANSFORMED,
  COMPLY_FLOW_TRANSFORMATION_TYPE,
  COMPLY_ACCESS_GRANTED,
  COMPLY_ACCESS_METHOD,
  COMPLY_ACCESS_MFA_VERIFIED,
  COMPLY_ACCESS_DATA_CLASS,
  COMPLY_ACCESS_RECORD_COUNT,
  COMPLY_ACCESS_BATCH_REASON,
] as const;
