# Getting Started

## Installation

```bash
npm install @complyflow/sdk
```

The SDK depends on OpenTelemetry packages which are installed automatically.

## Initialization

Call `comply.init()` once at application startup, before any other `comply.*` calls:

```typescript
import { comply } from '@complyflow/sdk';

comply.init({
  apiKey: process.env.COMPLYFLOW_API_KEY!,
  tenantId: process.env.COMPLYFLOW_TENANT_ID!,
  endpoint: 'https://ingest.complyflow.io',
  serviceName: 'my-service',
});
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `apiKey` | Yes | Your ComplyFlow API key |
| `tenantId` | Yes | Your organization ID |
| `endpoint` | Yes | ComplyFlow ingestion URL |
| `serviceName` | No | Name of this service (defaults to 'unknown-service') |

## Instrumenting Your Code

Add compliance calls at the points where your application handles sensitive data:

### Data Access

When your code reads, writes, or deletes sensitive data:

```typescript
comply.dataAccess({
  resource: 'postgres:patients.medical_records',
  action: 'read',
  dataClassification: 'PHI',
  actor: { userId: req.user.id, role: req.user.role },
  encrypted: true,
});
```

### Access Control

When your code makes an access control decision:

```typescript
comply.accessControl({
  resource: 'admin-panel',
  actor: { userId: req.user.id, role: req.user.role },
  granted: hasPermission,
  method: 'rbac',
  mfaVerified: req.user.mfaVerified,
  dataClassification: 'PHI',
});
```

### Data Flow

When data moves between services:

```typescript
comply.dataFlow({
  from: 'patient-api',
  to: 'analytics-pipeline',
  dataClassification: 'PHI',
  encrypted: false,
  transformed: true,
  transformationType: 'k-anonymity',
});
```

## Shutdown

Call `comply.shutdown()` during graceful shutdown to flush pending telemetry:

```typescript
process.on('SIGTERM', async () => {
  await comply.shutdown();
  process.exit(0);
});
```

## What Happens Next

The SDK sends structured OpenTelemetry spans to the ComplyFlow platform. The platform:

1. Receives the spans via OTLP/HTTP
2. Transforms them into compliance events
3. Builds a map of your system topology from observed behavior
4. Evaluates events and topology against compliance policies (HIPAA, SOC 2, GDPR, PCI-DSS)
5. Surfaces violations in the dashboard and API

You can query your compliance state at any time via the REST API.

## Production Considerations

### Telemetry Buffering and Data Loss

The SDK uses OpenTelemetry's `BatchSpanProcessor`, which:
- Holds compliance events in an in-memory buffer
- Flushes to the ComplyFlow platform every 5 seconds (default)
- Retries on transient HTTP failures

**What this means:** If your application process crashes between when a compliance event is emitted and when the next batch flushes, events in the buffer are lost. The worst-case window is one batch interval (~5 seconds).

For the ComplyFlow use case (compliance observation and audit evidence), this trade-off is usually acceptable — compliance is retrospective, not real-time enforcement. A 5-second loss window on a process crash is tolerable because:
- The event was already attempted (the underlying operation completed)
- Auditors evaluate patterns across many events, not single events
- Your application likely has other logging that captures critical state

### If You Need Stronger Durability

For high-compliance use cases where every event must survive a crash:

1. **Reduce batch interval** — pass a custom `BatchSpanProcessor` with smaller `scheduledDelayMillis` (e.g., 500ms). More HTTP traffic, smaller loss window.

2. **Call `comply.shutdown()` in graceful-shutdown handlers** — always, for SIGTERM/SIGINT. This flushes pending events.

3. **Persistent queue (advanced)** — OpenTelemetry supports pluggable exporters. You can wrap the ComplyFlow exporter with a file-backed queue using a library like `@opentelemetry/exporter-prometheus` patterns. We don't ship this out of the box; contact us if you need guidance.

4. **Accept the trade-off** — for most compliance programs, a 5-second batch window is well within the acceptable range for audit evidence. Don't over-engineer.

### Graceful Shutdown

Always call `comply.shutdown()` in your termination handlers:

```typescript
process.on('SIGTERM', async () => {
  await comply.shutdown(); // flushes pending spans
  process.exit(0);
});
process.on('SIGINT', async () => {
  await comply.shutdown();
  process.exit(0);
});
```

### Async Workflows

If your code uses background jobs, message queues, or worker processes, read the [Async Context Propagation guide](async-context.md). Actor context doesn't propagate automatically across async boundaries — you have to pass it explicitly.

### Rate Limiting

The ComplyFlow platform rate-limits incoming telemetry per tenant (default: 1000 events/second with a burst of 2000). The SDK's exporter handles HTTP 429 responses with exponential backoff, so transient throttling is invisible to your application. If you expect sustained high event rates (for example, a high-traffic monitoring endpoint), contact us to adjust your tenant's quota.

### Bulk Operations

For operations that access many records at once (monthly reports, data migrations, bulk exports), use the `recordCount` and `batchReason` fields on `dataAccess()`:

```typescript
comply.dataAccess({
  resource: 'postgres:patients',
  action: 'read',
  dataClassification: 'PHI',
  actor: { userId: 'report-job', role: 'system' },
  recordCount: 50000,
  batchReason: 'monthly-compliance-report',
});
```

This produces a single event representing the bulk access, not 50,000 individual events.
