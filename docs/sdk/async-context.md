# Async Context Propagation

When your application uses background jobs, message queues, or any async workflow that crosses process or request boundaries, actor context (user ID, role) needs to travel with the work. ComplyFlow doesn't automatically propagate this context — you have to pass it explicitly.

## The Problem

```typescript
// Route handler — actor context is available
app.post('/api/patients/:id/archive', async (req, res) => {
  comply.dataAccess({
    resource: `patient:${req.params.id}`,
    action: 'read',
    dataClassification: 'PHI',
    actor: { userId: req.user.id, role: req.user.role }, // known here
  });

  await queue.publish('archive-patient', { patientId: req.params.id });
  res.send(202);
});

// Worker — different process, different time
worker.on('archive-patient', async (job) => {
  // req.user doesn't exist here. Who is the actor?
  comply.dataAccess({
    resource: `patient:${job.patientId}`,
    action: 'write',
    dataClassification: 'PHI',
    actor: { /* ??? */ }, // missing
  });
});
```

Without actor context, the access-control policy will flag every background-job data access as a compliance violation ("§164.312(a)(2)(i): ePHI accessed without unique user identification").

## The Solution: Explicit Context Propagation

Pass the actor context as part of the job payload. Recover it in the consumer.

```typescript
// Producer
await queue.publish('archive-patient', {
  patientId: req.params.id,
  _actor: {
    userId: req.user.id,
    role: req.user.role,
  },
});

// Consumer
worker.on('archive-patient', async (job) => {
  comply.dataAccess({
    resource: `patient:${job.patientId}`,
    action: 'write',
    dataClassification: 'PHI',
    actor: job._actor, // restored from payload
  });
});
```

## BullMQ Example

```typescript
// Producer
await queue.add('archive-patient', {
  patientId,
  _actor: { userId: req.user.id, role: req.user.role },
});

// Consumer
const worker = new Worker('archive-patient', async (job) => {
  const { patientId, _actor } = job.data;

  comply.dataAccess({
    resource: `patient:${patientId}`,
    action: 'write',
    dataClassification: 'PHI',
    actor: _actor,
  });

  await archivePatient(patientId);
});
```

## AWS SQS Example

```typescript
// Producer
await sqs.send(new SendMessageCommand({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify({
    patientId,
    _actor: { userId: req.user.id, role: req.user.role },
  }),
}));

// Consumer
for (const msg of messages) {
  const { patientId, _actor } = JSON.parse(msg.Body);

  comply.dataAccess({
    resource: `patient:${patientId}`,
    action: 'write',
    dataClassification: 'PHI',
    actor: _actor,
  });
}
```

## In-Process Async (Promises, setImmediate)

For async work that stays in the same process, JavaScript closures capture the actor naturally:

```typescript
app.post('/api/export', async (req, res) => {
  const actor = { userId: req.user.id, role: req.user.role };

  // Async job stays in the same process
  setImmediate(() => {
    comply.dataAccess({
      resource: 'export-bucket',
      action: 'write',
      dataClassification: 'PHI',
      actor, // closure captures it
    });
  });

  res.send(202);
});
```

No special handling needed.

## Service-to-Service via HTTP

When calling another service that's also running ComplyFlow, use the standard W3C `traceparent` header. OpenTelemetry's HTTP instrumentation propagates this automatically. The receiving service's own compliance events will be associated with the same trace ID.

If you also want to propagate actor identity to a different service, include it explicitly in the request body or a custom header (`x-complyflow-actor-user-id`). The receiving service reads it and passes it to `comply.dataAccess({ actor: ... })`.

## Design Pattern: Context Extractor Helper

For cleanliness, define a helper in your application:

```typescript
// utils/comply-context.ts
export function extractActor(req: AuthenticatedRequest) {
  return {
    userId: req.user.id,
    role: req.user.role,
  };
}

export function packJob<T>(actor: ReturnType<typeof extractActor>, payload: T) {
  return { ...payload, _actor: actor };
}

export function unpackJob<T>(jobData: T & { _actor: any }) {
  const { _actor, ...payload } = jobData;
  return { actor: _actor, payload: payload as T };
}
```

```typescript
// Producer
await queue.add('job', packJob(extractActor(req), { patientId }));

// Consumer
worker.on('job', async (job) => {
  const { actor, payload } = unpackJob(job.data);
  comply.dataAccess({ actor, resource: `patient:${payload.patientId}`, /* ... */ });
});
```

## What Not to Do

**Don't use a global variable.** Actor context is per-request. A global would race between concurrent requests.

**Don't use `process.env` or singleton state.** Same problem — not request-scoped.

**Don't skip the context and file a "service" actor instead.** That hides the real user behind a system account, which defeats the audit trail the compliance platform is building.

**Don't log actor to stdout and hope to correlate later.** That's exactly what compliance platforms exist to avoid.

## Future Improvement

The SDK currently doesn't expose OpenTelemetry's `context.with()` / `trace.setSpan()` primitives. A future SDK version may add context helpers to make this more ergonomic. For now, explicit payload propagation is the recommended pattern.
