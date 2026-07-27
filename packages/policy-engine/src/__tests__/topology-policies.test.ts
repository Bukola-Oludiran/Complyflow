import { describe, it, expect, afterEach } from 'vitest';
import { TenantManager } from '@complyflow/graph-builder';
import { HIPAA_POLICIES } from '../frameworks/hipaa/index.js';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

function makeEvent(overrides: Partial<ComplianceEvent> = {}): ComplianceEvent {
  return {
    tenantId: 'tenant-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    timestamp: Date.now(),
    eventType: 'data-access',
    service: 'patient-api',
    resource: 'postgres:patients',
    action: 'read',
    actor: { userId: 'user-1', role: 'nurse' },
    dataClassification: 'PHI',
    encryptionState: 'encrypted',
    metadata: { auditLogged: true },
    ...overrides,
  };
}

function setupTenantWithAllPolicies(): {
  manager: TenantManager;
  violations: ComplianceViolation[];
} {
  const violations: ComplianceViolation[] = [];
  const manager = new TenantManager({
    onViolation: (_tenantId, violation) => {
      violations.push(violation);
    },
  });
  for (const policy of HIPAA_POLICIES) {
    manager.addPolicyNode('tenant-1', policy.nodeId, policy.definition, policy.acceptsTypes);
  }
  return { manager, violations };
}

describe('Topology-Aware HIPAA Policies', () => {
  let manager: TenantManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  describe('PHI Data Flow Path — §164.312(e)(2)(ii) topology (Addressable)', () => {
    it('detects unencrypted PHI data flow between services', async () => {
      const { manager: m, violations } = setupTenantWithAllPolicies();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        service: 'patient-api',
        resource: '',
        metadata: {
          'comply.flow.from': 'patient-api',
          'comply.flow.to': 'analytics-pipeline',
        },
        dataClassification: 'PHI',
        encryptionState: 'plaintext',
      })]);
      await new Promise(resolve => setTimeout(resolve, 200));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-data-flow-path');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].severity).toBe('high'); // Addressable
      expect(v[0].ruleId).toBe('164.312(e)(2)(ii)');
    });

    it('does not flag encrypted PHI data flows', async () => {
      const { manager: m, violations } = setupTenantWithAllPolicies();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        service: 'patient-api',
        resource: '',
        metadata: {
          'comply.flow.from': 'patient-api',
          'comply.flow.to': 'backup-service',
        },
        dataClassification: 'PHI',
        encryptionState: 'encrypted',
      })]);
      await new Promise(resolve => setTimeout(resolve, 200));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-data-flow-path');
      expect(v).toHaveLength(0);
    });
  });

  describe('PHI Access Scope — §164.312(b) topology (Required)', () => {
    it('detects service accessing PHI without audit logging', async () => {
      const { manager: m, violations } = setupTenantWithAllPolicies();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: {} })]);
      await new Promise(resolve => setTimeout(resolve, 200));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-scope');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].severity).toBe('high');
      expect(v[0].ruleId).toBe('164.312(b)');
    });

    it('does not flag service with audit logging accessing PHI', async () => {
      const { manager: m, violations } = setupTenantWithAllPolicies();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: { auditLogged: true } })]);
      await new Promise(resolve => setTimeout(resolve, 200));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-scope');
      expect(v).toHaveLength(0);
    });

    it('does not flag service accessing non-PHI resources', async () => {
      const { manager: m, violations } = setupTenantWithAllPolicies();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        dataClassification: 'public',
        metadata: {},
      })]);
      await new Promise(resolve => setTimeout(resolve, 200));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-scope');
      expect(v).toHaveLength(0);
    });
  });
});
