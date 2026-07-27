import { describe, it, expect, afterEach } from 'vitest';
import { TokenBucketRateLimiter } from '../rate-limiter.js';
import { OtlpReceiver } from '../otlp-receiver.js';
import type { OtlpExportTraceServiceRequest } from '../otlp-types.js';

function makeOtlpRequest(eventCount = 1): OtlpExportTraceServiceRequest {
  return {
    resourceSpans: [{
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: 'test' } }],
      },
      scopeSpans: [{
        spans: Array.from({ length: eventCount }, (_, i) => ({
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
          name: 'test',
          startTimeUnixNano: '1700000000000000000',
          endTimeUnixNano: '1700000001000000000',
          attributes: [
            { key: 'comply.event_type', value: { stringValue: 'data-access' } },
            { key: 'comply.resource', value: { stringValue: 'test' } },
            { key: 'comply.action', value: { stringValue: 'read' } },
          ],
        })),
      }],
    }],
  };
}

describe('TokenBucketRateLimiter', () => {
  it('allows requests under the burst limit', () => {
    const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 10, burst: 100 });
    for (let i = 0; i < 50; i++) {
      expect(limiter.tryConsume('tenant-1').allowed).toBe(true);
    }
  });

  it('rejects requests exceeding burst', () => {
    const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 1, burst: 10 });
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume('tenant-1').allowed).toBe(true);
    }
    const result = limiter.tryConsume('tenant-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates buckets across tenants', () => {
    const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 1, burst: 5 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('tenant-a').allowed).toBe(true);
    }
    expect(limiter.tryConsume('tenant-a').allowed).toBe(false);
    // Different tenant still has a fresh bucket
    expect(limiter.tryConsume('tenant-b').allowed).toBe(true);
  });

  it('refills tokens over time', async () => {
    const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 100, burst: 5 });
    for (let i = 0; i < 5; i++) limiter.tryConsume('t');
    expect(limiter.tryConsume('t').allowed).toBe(false);

    // Wait 100ms — should refill ~10 tokens at 100/sec
    await new Promise(r => setTimeout(r, 100));
    expect(limiter.tryConsume('t').allowed).toBe(true);
  });

  it('supports multi-token consumption', () => {
    const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 1, burst: 10 });
    expect(limiter.tryConsume('t', 5).allowed).toBe(true);
    expect(limiter.tryConsume('t', 5).allowed).toBe(true);
    expect(limiter.tryConsume('t', 1).allowed).toBe(false);
  });
});

describe('OtlpReceiver with rate limiting', () => {
  let receiver: OtlpReceiver | null = null;

  afterEach(async () => {
    if (receiver) {
      await receiver.stop();
      receiver = null;
    }
  });

  it('returns 429 when tenant exceeds rate limit', async () => {
    receiver = new OtlpReceiver({
      port: 14450,
      host: '127.0.0.1',
      onEvents: () => {},
      rateLimitPerTenant: { tokensPerSecond: 1, burst: 5 },
    });
    await receiver.start();

    // Burn through the burst with a single large request
    const r1 = await fetch('http://127.0.0.1:14450/v1/traces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-complyflow-api-key': 'key',
        'x-complyflow-tenant-id': 't',
      },
      body: JSON.stringify(makeOtlpRequest(5)),
    });
    expect(r1.status).toBe(200);

    // Next request should 429
    const r2 = await fetch('http://127.0.0.1:14450/v1/traces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-complyflow-api-key': 'key',
        'x-complyflow-tenant-id': 't',
      },
      body: JSON.stringify(makeOtlpRequest(1)),
    });
    expect(r2.status).toBe(429);
    expect(r2.headers.get('retry-after')).toBeTruthy();
  });

  it('allows disabling rate limiting via null', async () => {
    const received: number[] = [];
    receiver = new OtlpReceiver({
      port: 14451,
      host: '127.0.0.1',
      onEvents: (_tenant, events) => received.push(events.length),
      rateLimitPerTenant: null,
    });
    await receiver.start();

    // Send way more than any reasonable burst
    for (let i = 0; i < 20; i++) {
      const r = await fetch('http://127.0.0.1:14451/v1/traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-complyflow-api-key': 'key',
          'x-complyflow-tenant-id': 't',
        },
        body: JSON.stringify(makeOtlpRequest(100)),
      });
      expect(r.status).toBe(200);
    }
    expect(received).toHaveLength(20);
  });

  it('isolates rate limits per tenant', async () => {
    receiver = new OtlpReceiver({
      port: 14452,
      host: '127.0.0.1',
      onEvents: () => {},
      rateLimitPerTenant: { tokensPerSecond: 1, burst: 3 },
    });
    await receiver.start();

    // Burn tenant-a
    await fetch('http://127.0.0.1:14452/v1/traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-complyflow-api-key': 'k', 'x-complyflow-tenant-id': 'tenant-a' },
      body: JSON.stringify(makeOtlpRequest(3)),
    });
    const aBlocked = await fetch('http://127.0.0.1:14452/v1/traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-complyflow-api-key': 'k', 'x-complyflow-tenant-id': 'tenant-a' },
      body: JSON.stringify(makeOtlpRequest(1)),
    });
    expect(aBlocked.status).toBe(429);

    // tenant-b is unaffected
    const bAllowed = await fetch('http://127.0.0.1:14452/v1/traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-complyflow-api-key': 'k', 'x-complyflow-tenant-id': 'tenant-b' },
      body: JSON.stringify(makeOtlpRequest(1)),
    });
    expect(bAllowed.status).toBe(200);
  });
});
