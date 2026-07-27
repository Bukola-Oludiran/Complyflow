import { describe, it, expect, afterEach } from 'vitest';
import { OtlpReceiver } from '../otlp-receiver.js';
import type { ComplianceEvent } from '@complyflow/shared';
import type { OtlpExportTraceServiceRequest } from '../otlp-types.js';

function makeOtlpRequest(): OtlpExportTraceServiceRequest {
  return {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'test-service' } },
        ],
      },
      scopeSpans: [{
        spans: [{
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'comply.data-access',
          startTimeUnixNano: '1700000000000000000',
          endTimeUnixNano: '1700000001000000000',
          attributes: [
            { key: 'comply.event_type', value: { stringValue: 'data-access' } },
            { key: 'comply.resource', value: { stringValue: 'postgres:users' } },
            { key: 'comply.action', value: { stringValue: 'read' } },
            { key: 'comply.data_class', value: { stringValue: 'PHI' } },
          ],
        }],
      }],
    }],
  };
}

describe('OtlpReceiver', () => {
  let receiver: OtlpReceiver | null = null;

  afterEach(async () => {
    if (receiver) {
      await receiver.stop();
      receiver = null;
    }
  });

  it('receives OTLP traces and extracts ComplianceEvents', async () => {
    const received: { tenantId: string; events: ComplianceEvent[] }[] = [];

    receiver = new OtlpReceiver({
      port: 14318,
      host: '127.0.0.1',
      onEvents: (tenantId, events) => {
        received.push({ tenantId, events });
      },
    });
    await receiver.start();

    const response = await fetch('http://127.0.0.1:14318/v1/traces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-complyflow-api-key': 'test-key',
        'x-complyflow-tenant-id': 'tenant-abc',
      },
      body: JSON.stringify(makeOtlpRequest()),
    });

    expect(response.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0].tenantId).toBe('tenant-abc');
    expect(received[0].events).toHaveLength(1);
    expect(received[0].events[0].eventType).toBe('data-access');
    expect(received[0].events[0].resource).toBe('postgres:users');
    expect(received[0].events[0].dataClassification).toBe('PHI');
  });

  it('returns 401 for missing auth headers', async () => {
    receiver = new OtlpReceiver({
      port: 14319,
      host: '127.0.0.1',
      onEvents: () => {},
    });
    await receiver.start();

    const response = await fetch('http://127.0.0.1:14319/v1/traces', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 for non-trace endpoints', async () => {
    receiver = new OtlpReceiver({
      port: 14320,
      host: '127.0.0.1',
      onEvents: () => {},
    });
    await receiver.start();

    const response = await fetch('http://127.0.0.1:14320/v1/metrics', {
      method: 'POST',
    });

    expect(response.status).toBe(404);
  });
});
