import { describe, it, expect } from 'vitest';
import { spanToComplianceEvent } from '../span-transformer.js';
import type { OtlpSpan, OtlpResource } from '../otlp-types.js';

function makeSpan(attrs: Record<string, string | boolean | number>): OtlpSpan {
  return {
    traceId: 'abc123',
    spanId: 'def456',
    name: 'test-span',
    startTimeUnixNano: '1700000000000000000',
    endTimeUnixNano: '1700000001000000000',
    attributes: Object.entries(attrs).map(([key, value]) => ({
      key,
      value: typeof value === 'string'
        ? { stringValue: value }
        : typeof value === 'boolean'
          ? { boolValue: value }
          : { intValue: value },
    })),
  };
}

describe('spanToComplianceEvent', () => {
  it('transforms a data-access span into a ComplianceEvent', () => {
    const span = makeSpan({
      'comply.event_type': 'data-access',
      'comply.resource': 'postgres:patients.ssn',
      'comply.action': 'read',
      'comply.actor.user_id': 'user-1',
      'comply.actor.role': 'nurse',
      'comply.data_class': 'PHI',
      'comply.encryption_state': 'encrypted',
    });

    const event = spanToComplianceEvent(span, undefined, 'tenant-123');

    expect(event).not.toBeNull();
    expect(event!.tenantId).toBe('tenant-123');
    expect(event!.traceId).toBe('abc123');
    expect(event!.spanId).toBe('def456');
    expect(event!.eventType).toBe('data-access');
    expect(event!.resource).toBe('postgres:patients.ssn');
    expect(event!.action).toBe('read');
    expect(event!.actor.userId).toBe('user-1');
    expect(event!.actor.role).toBe('nurse');
    expect(event!.dataClassification).toBe('PHI');
    expect(event!.encryptionState).toBe('encrypted');
  });

  it('returns null for spans without comply.event_type', () => {
    const span = makeSpan({ 'http.method': 'GET' });
    expect(spanToComplianceEvent(span, undefined, 'tenant-123')).toBeNull();
  });

  it('returns null for spans with invalid event type', () => {
    const span = makeSpan({ 'comply.event_type': 'invalid-type' });
    expect(spanToComplianceEvent(span, undefined, 'tenant-123')).toBeNull();
  });

  it('returns null when no tenant ID is available', () => {
    const span = makeSpan({ 'comply.event_type': 'data-access' });
    expect(spanToComplianceEvent(span, undefined)).toBeNull();
  });

  it('reads tenant ID from span attributes if not overridden', () => {
    const span = makeSpan({
      'comply.event_type': 'data-access',
      'comply.tenant_id': 'tenant-from-span',
    });

    const event = spanToComplianceEvent(span, undefined);
    expect(event).not.toBeNull();
    expect(event!.tenantId).toBe('tenant-from-span');
  });

  it('reads service name from resource attributes', () => {
    const span = makeSpan({ 'comply.event_type': 'data-access' });
    const resource: OtlpResource = {
      attributes: [{ key: 'service.name', value: { stringValue: 'patient-api' } }],
    };

    const event = spanToComplianceEvent(span, resource, 'tenant-123');
    expect(event!.service).toBe('patient-api');
  });

  it('prefers comply.service over resource service.name', () => {
    const span = makeSpan({
      'comply.event_type': 'data-access',
      'comply.service': 'custom-service',
    });
    const resource: OtlpResource = {
      attributes: [{ key: 'service.name', value: { stringValue: 'resource-service' } }],
    };

    const event = spanToComplianceEvent(span, resource, 'tenant-123');
    expect(event!.service).toBe('custom-service');
  });

  it('collects non-comply attributes as metadata', () => {
    const span = makeSpan({
      'comply.event_type': 'data-access',
      'http.method': 'GET',
      'http.url': '/api/patients',
    });

    const event = spanToComplianceEvent(span, undefined, 'tenant-123');
    expect(event!.metadata).toEqual({
      'http.method': 'GET',
      'http.url': '/api/patients',
    });
  });
});
