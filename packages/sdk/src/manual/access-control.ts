import { trace } from '@opentelemetry/api';
import type { AccessControlInput } from '@complyflow/shared';
import {
  COMPLY_EVENT_TYPE,
  COMPLY_RESOURCE,
  COMPLY_ACTOR_USER_ID,
  COMPLY_ACTOR_ROLE,
  COMPLY_ACTOR_SERVICE,
  COMPLY_ACCESS_GRANTED,
  COMPLY_ACCESS_METHOD,
  COMPLY_ACCESS_MFA_VERIFIED,
  COMPLY_ACCESS_DATA_CLASS,
} from '@complyflow/shared';

const tracer = trace.getTracer('complyflow-sdk');

/**
 * Record an access control decision for compliance tracking.
 */
export function accessControl(input: AccessControlInput): void {
  const span = tracer.startSpan('comply.access-control');

  span.setAttribute(COMPLY_EVENT_TYPE, 'access-control');
  span.setAttribute(COMPLY_RESOURCE, input.resource);
  span.setAttribute(COMPLY_ACCESS_GRANTED, input.granted);

  if (input.actor.userId) {
    span.setAttribute(COMPLY_ACTOR_USER_ID, input.actor.userId);
  }
  if (input.actor.role) {
    span.setAttribute(COMPLY_ACTOR_ROLE, input.actor.role);
  }
  if (input.actor.service) {
    span.setAttribute(COMPLY_ACTOR_SERVICE, input.actor.service);
  }
  if (input.method) {
    span.setAttribute(COMPLY_ACCESS_METHOD, input.method);
  }
  if (input.mfaVerified !== undefined) {
    span.setAttribute(COMPLY_ACCESS_MFA_VERIFIED, input.mfaVerified);
  }
  if (input.dataClassification) {
    span.setAttribute(COMPLY_ACCESS_DATA_CLASS, input.dataClassification);
  }

  span.end();
}
