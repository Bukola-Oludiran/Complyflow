import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { ComplyFlowConfig } from '@complyflow/shared';

/**
 * Creates an OTLP exporter configured to send traces to the ComplyFlow
 * ingestion endpoint with auth headers.
 */
export function createExporter(config: ComplyFlowConfig): OTLPTraceExporter {
  return new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
    headers: {
      'x-complyflow-api-key': config.apiKey,
      'x-complyflow-tenant-id': config.tenantId,
    },
  });
}
