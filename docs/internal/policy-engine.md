# Policy Engine

## Overview

The policy engine evaluates compliance rules against telemetry events and graph topology. Each policy is a GraphReact node created with `defineNode()` that uses hooks to process events and emit violations.

## Supported Frameworks

| Framework | Policies | Regulatory Source |
|-----------|---------|-------------------|
| HIPAA | 9 (6 Layer 1, 3 Layer 2) | 45 CFR §164 (Security Rule + Privacy Rule) |
| SOC 2 | 3 | AICPA Trust Services Criteria 2017:2022 |
| GDPR | 2 | EU Regulation 2016/679 |
| PCI-DSS | 4 | PCI DSS 4.0.1 |

Cross-framework mappings sourced from the Secure Controls Framework (SCF) meta-framework.

## Layer 1 vs Layer 2

**Layer 1 (stateless):** Evaluates individual events as they arrive. Uses `useMessage()` to receive events and check conditions.

**Layer 2 (topology-aware):** Evaluates the graph structure. Uses `useTopology()` to react to topology changes and `useGraphQuery()` + `allPaths()` to analyze data flow paths.

## Shared Detection Functions

`packages/policy-engine/src/detections/index.ts`

All detection logic lives in shared functions parameterized by `targetClassifications`:

```typescript
detectMissingUserId(event, ['PHI'])        // HIPAA
detectMissingUserId(event, ['PHI', 'PII']) // GDPR
detectMissingUserId(event, ['PCI'])        // PCI-DSS
detectMissingUserId(event, ['PHI', 'PII', 'PCI', 'internal']) // SOC 2
```

Available detections:
- `detectMissingUserId` — no actor.userId on sensitive data access
- `detectMissingRole` — userId present but no role defined
- `detectMissingAuditLog` — metadata.auditLogged not set
- `detectPlaintextAtRest` — encryptionState === 'plaintext' on data-access
- `detectPlaintextInTransit` — encryptionState === 'plaintext' on data-flow
- `detectMissingMfa` — MFA not verified on access-control grant

## Adding a New Policy

### Layer 1 (stateless)

```typescript
// packages/policy-engine/src/frameworks/<framework>/<policy-name>.ts
import { defineNode, useMessage, useEmit } from 'graphreact';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';
import { detectMissingUserId } from '../../detections/index.js';

let violationCounter = 0;

export const MyPolicy = defineNode('MyPolicy', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    const event = msg.payload as ComplianceEvent;
    const result = detectMissingUserId(event, ['PHI']);
    if (result.detected) {
      emit('violation', {
        id: `my-policy-${++violationCounter}`,
        tenantId: event.tenantId,
        policyId: 'my-policy-id',
        framework: 'HIPAA',
        ruleId: '164.312(a)(2)(i)',
        severity: 'critical',
        title: 'Short title',
        description: `${result.detail} Regulatory citation here.`,
        evidence: [event],
        detectedAt: Date.now(),
        resource: event.resource,
        service: event.service,
      } satisfies ComplianceViolation);
    }
  });

  return { accepts: ['data-access'], emits: ['violation'] };
});
```

### Layer 2 (topology-aware)

```typescript
export const MyTopologyPolicy = defineNode('MyTopologyPolicy', () => {
  const emit = useEmit();
  const [topologyVersion, setTopologyVersion] = useState(0);

  useTopology(() => {
    setTopologyVersion(v => v + 1);
  }, { types: ['edge-added', 'edge-updated'] });

  const findings = useGraphQuery((graph) => {
    // Query graph structure using allPaths(), graph.nodes(), etc.
    return violations;
  }, [topologyVersion]);

  // Emit findings as violations
  return { accepts: [], emits: ['violation'] };
});
```

### Register the policy

Add to the framework's `index.ts`:

```typescript
export const MY_FRAMEWORK_POLICIES: PolicyDefinition[] = [
  {
    nodeId: 'my-policy-id',          // unique across all frameworks
    definition: MyPolicy,
    acceptsTypes: ['data-access'],   // empty [] for topology-only
  },
];
```

## Required vs Addressable (HIPAA)

HIPAA distinguishes between Required and Addressable specifications:

- **Required** → severity `critical` or `high`
- **Addressable** → severity `high` or `medium`, description must include: "This is an Addressable specification. If not implemented, the organization must document why and implement an equivalent alternative measure per §164.306(d)(3)."

## HIPAA Policy Reference

| Policy | CFR Section | Required/Addressable | Severity |
|--------|------------|---------------------|----------|
| hipaa-phi-access-control | §164.312(a)(2)(i) | Required | critical/high |
| hipaa-phi-audit-logging | §164.312(b) | Required | high |
| hipaa-phi-encryption-at-rest | §164.312(a)(2)(iv) | Addressable | high |
| hipaa-phi-encryption-in-transit | §164.312(e)(2)(ii) | Addressable | high |
| hipaa-phi-person-auth | §164.312(d) | Required | critical |
| hipaa-phi-login-monitoring | §164.308(a)(5)(ii)(C) | Addressable | medium |
| hipaa-phi-data-flow-path | §164.312(e)(2)(ii) | Addressable | high |
| hipaa-phi-access-scope | §164.312(b) | Required | high |
| hipaa-phi-minimum-necessary | §164.502(b) | Privacy Rule | medium |

## File Structure

```
policy-engine/src/
  detections/index.ts       # Shared detection functions
  frameworks/
    hipaa/                  # 9 policies
    soc2/                   # 3 policies (CC6.1, CC6.7, CC7.2)
    gdpr/                   # 2 policies (Art 32, Art 5)
    pci-dss/                # 4 policies (Req 3, 4, 7+8, 10)
  index.ts                  # Exports ALL_POLICIES, per-framework arrays
```
