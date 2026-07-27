import { trace } from '@opentelemetry/api';
import type { DataFlowInput } from '@complyflow/shared';
import {
  COMPLY_EVENT_TYPE,
  COMPLY_FLOW_FROM,
  COMPLY_FLOW_TO,
  COMPLY_DATA_CLASS,
  COMPLY_ENCRYPTION_STATE,
  COMPLY_FLOW_TRANSFORMED,
  COMPLY_FLOW_TRANSFORMATION_TYPE,
} from '@complyflow/shared';

const tracer = trace.getTracer('complyflow-sdk');

/**
 * Record a data flow event between services/resources for compliance tracking.
 */
export function dataFlow(input: DataFlowInput): void {
  const span = tracer.startSpan('comply.data-flow');

  span.setAttribute(COMPLY_EVENT_TYPE, 'data-flow');
  span.setAttribute(COMPLY_FLOW_FROM, input.from);
  span.setAttribute(COMPLY_FLOW_TO, input.to);

  if (input.dataClassification) {
    span.setAttribute(COMPLY_DATA_CLASS, input.dataClassification);
  }
  if (input.encrypted !== undefined) {
    span.setAttribute(COMPLY_ENCRYPTION_STATE, input.encrypted ? 'encrypted' : 'plaintext');
  }
  if (input.transformed !== undefined) {
    span.setAttribute(COMPLY_FLOW_TRANSFORMED, input.transformed);
  }
  if (input.transformationType) {
    span.setAttribute(COMPLY_FLOW_TRANSFORMATION_TYPE, input.transformationType);
  }

  span.end();
}
