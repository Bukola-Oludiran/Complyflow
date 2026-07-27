# ComplyFlow SDK

Instrument your application for continuous compliance monitoring. The ComplyFlow SDK is a lightweight wrapper around OpenTelemetry that sends compliance-relevant telemetry to the ComplyFlow platform.

## Quick Start

```bash
npm install @complyflow/sdk
```

```typescript
import { comply } from '@complyflow/sdk';

comply.init({
  apiKey: 'your-api-key',
  tenantId: 'your-org-id',
  endpoint: 'https://ingest.complyflow.io',
  serviceName: 'patient-api',
});

// Record a data access event
comply.dataAccess({
  resource: 'postgres:patients.records',
  action: 'read',
  dataClassification: 'PHI',
  actor: { userId: 'nurse-1', role: 'nurse' },
  encrypted: true,
});
```

## Contents

- [Getting Started](getting-started.md) — Installation, initialization, first instrumentation
- [API Reference](api-reference.md) — All SDK methods and their parameters
- [Data Classification](data-classification.md) — PHI, PII, PCI, public, internal
- [Async Context Propagation](async-context.md) — Passing actor context across background jobs and queues
- [Examples](examples.md) — Express app, common instrumentation patterns
