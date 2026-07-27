/**
 * OTLP JSON trace format types.
 * These match the OpenTelemetry protobuf-to-JSON encoding for ExportTraceServiceRequest.
 * See: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 */

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values: OtlpAnyValue[] };
}

export interface OtlpResource {
  attributes?: OtlpKeyValue[];
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpKeyValue[];
  status?: { code?: number };
}

export interface OtlpScopeSpans {
  scope?: { name?: string };
  spans?: OtlpSpan[];
}

export interface OtlpResourceSpans {
  resource?: OtlpResource;
  scopeSpans?: OtlpScopeSpans[];
}

export interface OtlpExportTraceServiceRequest {
  resourceSpans?: OtlpResourceSpans[];
}
