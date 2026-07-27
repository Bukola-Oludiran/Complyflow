# API Reference

## comply.init(config)

Initialize the SDK. Must be called once before any other method.

```typescript
comply.init({
  apiKey: string,
  tenantId: string,
  endpoint: string,
  serviceName?: string,
});
```

Throws if called more than once.

---

## comply.dataAccess(input)

Record an event when your application accesses a data resource.

```typescript
comply.dataAccess({
  resource: string,              // e.g., 'postgres:patients.ssn'
  action: 'read' | 'write' | 'delete' | 'list',
  dataClassification?: 'PHI' | 'PII' | 'PCI' | 'public' | 'internal',
  actor?: {
    userId?: string,             // unique user identifier
    role?: string,               // user's role (e.g., 'nurse', 'admin')
    service?: string,            // calling service (for service-to-service)
  },
  encrypted?: boolean,           // is the data encrypted at rest?
  reason?: string,               // why was this data accessed?
});
```

**Compliance impact:** This event is evaluated by policies that check:
- Whether a unique user ID is present (HIPAA §164.312(a)(2)(i), SOC 2 CC6.1, PCI Req 8.2)
- Whether audit logging is enabled (HIPAA §164.312(b), SOC 2 CC7.2, PCI Req 10.2, GDPR Art 5.1(f))
- Whether data is encrypted at rest (HIPAA §164.312(a)(2)(iv), SOC 2 CC6.1, PCI Req 3.5, GDPR Art 32.1(a))

---

## comply.accessControl(input)

Record an access control decision (grant or denial).

```typescript
comply.accessControl({
  resource: string,              // the resource being accessed
  actor: {
    userId?: string,
    role?: string,
    service?: string,
  },
  granted: boolean,              // was access granted or denied?
  method?: 'rbac' | 'abac' | 'acl' | 'custom',
  mfaVerified?: boolean,         // was multi-factor auth verified?
  dataClassification?: 'PHI' | 'PII' | 'PCI' | 'public' | 'internal',
});
```

**Compliance impact:** This event is evaluated by policies that check:
- Whether MFA is verified for sensitive data access (HIPAA §164.312(d), PCI Req 8.3)
- Patterns of denied access attempts (HIPAA §164.308(a)(5)(ii)(C))

---

## comply.dataFlow(input)

Record data flowing between services or components.

```typescript
comply.dataFlow({
  from: string,                  // source service name
  to: string,                    // destination service name
  dataClassification?: 'PHI' | 'PII' | 'PCI' | 'public' | 'internal',
  encrypted?: boolean,           // is the data encrypted in transit?
  transformed?: boolean,         // was the data transformed (anonymized, etc.)?
  transformationType?: string,   // e.g., 'k-anonymity', 'tokenization'
});
```

**Compliance impact:** This event is evaluated by policies that check:
- Whether data is encrypted during transmission (HIPAA §164.312(e)(2)(ii), SOC 2 CC6.7, PCI Req 4.2.1, GDPR Art 32.1(a))
- Whether unencrypted paths exist in the system topology (HIPAA Layer 2 topology analysis)

---

## comply.shutdown()

Flush all pending telemetry and shut down the SDK.

```typescript
await comply.shutdown();
```

Returns a Promise that resolves when all pending spans have been exported.

---

## Type Exports

The SDK re-exports these types for convenience:

```typescript
import type {
  ComplyFlowConfig,
  DataAccessInput,
  AccessControlInput,
  DataFlowInput,
} from '@complyflow/sdk';
```
