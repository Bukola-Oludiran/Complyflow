import { trace } from '@opentelemetry/api';
import type { DataAccessInput } from '@complyflow/shared';
import {
  COMPLY_EVENT_TYPE,
  COMPLY_RESOURCE,
  COMPLY_ACTION,
  COMPLY_ACTOR_USER_ID,
  COMPLY_ACTOR_ROLE,
  COMPLY_ACTOR_SERVICE,
  COMPLY_DATA_CLASS,
  COMPLY_ENCRYPTION_STATE,
  COMPLY_ACCESS_RECORD_COUNT,
  COMPLY_ACCESS_BATCH_REASON,
} from '@complyflow/shared';

const tracer = trace.getTracer('complyflow-sdk');

/**
 * Record a data access event for compliance tracking.
 * Creates an OTel span with comply.* attributes.
 */
export function dataAccess(input: DataAccessInput): void {
  const span = tracer.startSpan('comply.data-access');

  span.setAttribute(COMPLY_EVENT_TYPE, 'data-access');
  span.setAttribute(COMPLY_RESOURCE, input.resource);
  span.setAttribute(COMPLY_ACTION, input.action);

  if (input.dataClassification) {
    span.setAttribute(COMPLY_DATA_CLASS, input.dataClassification);
  }
  if (input.encrypted !== undefined) {
    span.setAttribute(COMPLY_ENCRYPTION_STATE, input.encrypted ? 'encrypted' : 'plaintext');
  }
  if (input.actor?.userId) {
    span.setAttribute(COMPLY_ACTOR_USER_ID, input.actor.userId);
  }
  if (input.actor?.role) {
    span.setAttribute(COMPLY_ACTOR_ROLE, input.actor.role);
  }
  if (input.actor?.service) {
    span.setAttribute(COMPLY_ACTOR_SERVICE, input.actor.service);
  }
  if (input.reason) {
    span.setAttribute('comply.access.reason', input.reason);
  }
  if (input.recordCount !== undefined && input.recordCount > 1) {
    span.setAttribute(COMPLY_ACCESS_RECORD_COUNT, input.recordCount);
  }
  if (input.batchReason) {
    span.setAttribute(COMPLY_ACCESS_BATCH_REASON, input.batchReason);
  }

  span.end();
}
