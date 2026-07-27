# Testing

## Overview

65 tests across 12 test files. Framework: Vitest.

## Running Tests

```bash
# All tests
npx vitest run

# Watch mode
npx vitest

# Specific package
npx vitest run packages/policy-engine

# Specific test file
npx vitest run packages/api/src/__tests__/e2e.test.ts
```

## Test Structure

```
packages/
  sdk/src/__tests__/
    sdk.test.ts                    # SDK span creation (3 tests)
  ingestion/src/__tests__/
    span-transformer.test.ts       # OTel → ComplianceEvent transform (8 tests)
    otlp-receiver.test.ts          # HTTP receiver (3 tests)
  graph-builder/src/__tests__/
    topology-manager.test.ts       # Tenant management, policy registration (7 tests)
    ingress-topology.test.ts       # Auto-discovery topology building (7 tests)
  policy-engine/src/__tests__/
    hipaa.test.ts                  # HIPAA Layer 1 policies (9 tests)
    topology-policies.test.ts      # HIPAA Layer 2 policies (5 tests)
    soc2.test.ts                   # SOC 2 policies (5 tests)
    gdpr.test.ts                   # GDPR policies (5 tests)
    pci-dss.test.ts                # PCI-DSS policies (5 tests)
  api/src/__tests__/
    api.test.ts                    # REST API endpoints (6 tests)
    e2e.test.ts                    # Full pipeline: SDK → OTLP → Graph → Policy → API (2 tests)
```

## Test Patterns

### Policy tests
Each policy test suite:
1. Creates a `TenantManager` with an `onViolation` callback
2. Registers the framework's policies via `addPolicyNode()`
3. Sends events via `routeEvents()`
4. Waits for async processing (`await new Promise(r => setTimeout(r, 50))`)
5. Filters violations by `policyId` and asserts on `ruleId`, `severity`, `framework`

### Topology tests
Topology tests send events and then verify the graph structure:
- `graph.hasNode('svc:patient-api')` — node was created
- `graph.getNodeData(id).nodeType` — correct attributes
- `graph.hasEdge(svcId, resId)` — edge exists
- `graph.getEdgeData(svcId, resId).accessCount` — edge attributes updated

### E2E test
The end-to-end test runs the full pipeline:
1. Starts `OtlpReceiver` on a test port
2. Starts `ApiServer` on a test port
3. Creates `TenantManager` with HIPAA policies
4. Sends an OTLP HTTP request (simulating SDK)
5. Queries the API for violations
6. Verifies correct violations were detected

## Async Timing

GraphReact's scheduler uses `queueMicrotask` for message processing. Tests use `setTimeout(resolve, 50)` (or `200` for topology-aware policies) to wait for processing. Use generous timeouts for topology tests since they involve multiple processing cycles (event → topology mutation → topology event → policy re-evaluation → violation emission).

## Vitest Configuration

`vitest.config.ts` uses aliases to resolve workspace packages from source:

```typescript
resolve: {
  alias: {
    'graphreact': path.resolve(__dirname, '../GraphReact/graphreact/src/core/index.ts'),
    '@complyflow/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
    '@complyflow/graph-builder': path.resolve(__dirname, 'packages/graph-builder/src/index.ts'),
    // ... etc
  },
}
```

This means tests run against TypeScript source directly, not built output.

## Adding Tests

1. Create `packages/<package>/src/__tests__/<name>.test.ts`
2. Import from the package's source (not from dist)
3. Use `makeEvent()` helper for ComplianceEvent creation with sensible defaults
4. Use `setup()` helper that creates TenantManager + registers policies
5. Always clean up with `afterEach(() => manager.shutdown())`
