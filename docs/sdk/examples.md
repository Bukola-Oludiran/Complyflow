# Examples

## Express Application

```typescript
import express from 'express';
import { comply } from '@complyflow/sdk';

// Initialize once at startup
comply.init({
  apiKey: process.env.COMPLYFLOW_API_KEY!,
  tenantId: process.env.COMPLYFLOW_TENANT_ID!,
  endpoint: 'https://ingest.complyflow.io',
  serviceName: 'patient-api',
});

const app = express();

// Patient record endpoint
app.get('/api/patients/:id', async (req, res) => {
  const user = req.user; // from your auth middleware

  // Record the access control decision
  comply.accessControl({
    resource: `patient:${req.params.id}`,
    actor: { userId: user.id, role: user.role },
    granted: true,
    method: 'rbac',
    mfaVerified: user.mfaVerified,
    dataClassification: 'PHI',
  });

  // Fetch the record
  const patient = await db.patients.findById(req.params.id);

  // Record the data access
  comply.dataAccess({
    resource: 'postgres:patients.records',
    action: 'read',
    dataClassification: 'PHI',
    actor: { userId: user.id, role: user.role },
    encrypted: true,
    reason: 'treatment',
  });

  res.json(patient);
});

// Analytics data pipeline
app.post('/api/analytics/ingest', async (req, res) => {
  // Record data flowing to analytics
  comply.dataFlow({
    from: 'patient-api',
    to: 'analytics-pipeline',
    dataClassification: 'PHI',
    encrypted: true,
    transformed: true,
    transformationType: 'k-anonymity',
  });

  await analyticsQueue.push(anonymize(req.body));
  res.status(202).send();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await comply.shutdown();
  process.exit(0);
});

app.listen(3000);
```

## Protecting a Database Query

```typescript
async function getPatientRecord(patientId: string, user: AuthUser) {
  comply.dataAccess({
    resource: `postgres:patients.${patientId}`,
    action: 'read',
    dataClassification: 'PHI',
    actor: { userId: user.id, role: user.role },
    encrypted: true,
  });

  return db.query('SELECT * FROM patients WHERE id = $1', [patientId]);
}
```

## Recording Access Denials

```typescript
function authorizeAccess(user: AuthUser, resource: string): boolean {
  const granted = checkPermission(user, resource);

  comply.accessControl({
    resource,
    actor: { userId: user.id, role: user.role },
    granted,
    method: 'rbac',
    mfaVerified: user.mfaVerified,
    dataClassification: 'PHI',
  });

  return granted;
}
```

ComplyFlow tracks denied access patterns. Repeated denials from the same user may trigger a login monitoring violation.

## Service-to-Service Data Flow

```typescript
async function sendToPartner(data: PatientReferral) {
  comply.dataFlow({
    from: 'referral-service',
    to: 'partner-api',
    dataClassification: 'PHI',
    encrypted: true,
  });

  await fetch('https://partner.example.com/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypt(data)),
  });
}
```

## Payment Processing

```typescript
async function processPayment(card: CardData, user: AuthUser) {
  comply.dataAccess({
    resource: 'memory:card-data',
    action: 'read',
    dataClassification: 'PCI',
    actor: { userId: user.id, role: 'payment-processor' },
    encrypted: true,
  });

  comply.dataFlow({
    from: 'payment-service',
    to: 'stripe-api',
    dataClassification: 'PCI',
    encrypted: true,
  });

  return stripe.charges.create({ amount: card.amount, source: card.token });
}
```

## What Not to Instrument

You don't need to instrument:
- Public API endpoints that don't handle sensitive data
- Static file serving
- Health check endpoints
- Internal metrics/monitoring that don't contain PII/PHI/PCI

Focus instrumentation on code paths that handle sensitive data — the places where compliance risk lives.
