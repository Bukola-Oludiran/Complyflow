# Data Classification

Every compliance event should include a `dataClassification` that identifies what type of sensitive data is involved. This determines which compliance framework policies evaluate the event.

## Classifications

| Classification | Description | Frameworks that evaluate |
|---------------|-------------|------------------------|
| `PHI` | Protected Health Information — patient records, medical data, health insurance info | HIPAA, GDPR, SOC 2 |
| `PII` | Personally Identifiable Information — names, emails, addresses, SSN | GDPR, SOC 2 |
| `PCI` | Payment Card Industry data — credit card numbers, CVV, cardholder data | PCI-DSS, SOC 2 |
| `internal` | Internal business data — not regulated but not public | SOC 2 |
| `public` | Public data — no compliance controls applied | None |

## Which Classification to Use

**If it's health-related personal data** (patient names, diagnoses, prescriptions, insurance IDs):
Use `PHI`

**If it's personal data but not health-related** (email addresses, phone numbers, home addresses, SSN):
Use `PII`

**If it's payment card data** (card numbers, expiration dates, CVV, cardholder names in payment context):
Use `PCI`

**If it's business-sensitive but not personal or financial** (internal documents, trade secrets, employee IDs):
Use `internal`

**If it's meant to be publicly accessible** (public API responses, marketing content):
Use `public` (or omit the classification — unclassified data is not evaluated by compliance policies)

## Examples

```typescript
// Patient medical record — PHI
comply.dataAccess({
  resource: 'postgres:patients.medical_records',
  action: 'read',
  dataClassification: 'PHI',
  actor: { userId: 'nurse-1', role: 'nurse' },
});

// User email address — PII
comply.dataAccess({
  resource: 'postgres:users.email',
  action: 'read',
  dataClassification: 'PII',
  actor: { userId: 'support-1', role: 'support' },
});

// Credit card processing — PCI
comply.dataAccess({
  resource: 'vault:cards.pan',
  action: 'read',
  dataClassification: 'PCI',
  actor: { userId: 'payment-processor', role: 'system' },
  encrypted: true,
});

// Internal report — internal
comply.dataAccess({
  resource: 's3:reports/quarterly',
  action: 'read',
  dataClassification: 'internal',
  actor: { userId: 'analyst-1', role: 'analyst' },
});
```

## Data in Multiple Categories

Some data falls into multiple categories (e.g., a patient's credit card for co-pay is both PHI and PCI). Use the most restrictive classification — in this case `PHI`, since HIPAA's requirements are a superset of what PCI-DSS requires for this data.

## When Classification is Missing

If `dataClassification` is not set on an event, no framework-specific compliance policies will evaluate it. Always classify sensitive data access events.
