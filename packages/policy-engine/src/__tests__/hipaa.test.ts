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
    resource: 'postgres:patients.ssn',
    action: 'read',
    actor: { userId: 'user-1', role: 'nurse' },
    dataClassification: 'PHI',
    encryptionState: 'encrypted',
    metadata: { auditLogged: true },
    ...overrides,
  };
}

function setupTenantWithHipaa(): { manager: TenantManager; violations: ComplianceViolation[] } {
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

describe('HIPAA Policy Engine', () => {
  let manager: TenantManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  describe('PHI Access Control — §164.312(a)(2)(i) Unique User ID (Required)', () => {
    it('flags PHI access without authenticated user', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ actor: { role: 'unknown' } })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-control');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('164.312(a)(2)(i)');
      expect(v[0].severity).toBe('critical');
    });

    it('flags PHI access by user without defined role', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ actor: { userId: 'user-1' } })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(
        v => v.policyId === 'hipaa-phi-access-control' && v.severity === 'high'
      );
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag compliant PHI access', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent()]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-control');
      expect(v).toHaveLength(0);
    });

    it('ignores non-PHI data', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        dataClassification: 'public',
        actor: {},
      })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-access-control');
      expect(v).toHaveLength(0);
    });
  });

  describe('PHI Audit Logging — §164.312(b) Audit Controls (Required)', () => {
    it('flags PHI access that is not audit-logged', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: {} })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-audit-logging');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('164.312(b)');
    });

    it('does not flag audit-logged PHI access', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent()]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-audit-logging');
      expect(v).toHaveLength(0);
    });
  });

  describe('PHI Encryption at Rest — §164.312(a)(2)(iv) (Addressable)', () => {
    it('flags PHI accessed in plaintext', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ encryptionState: 'plaintext' })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-encryption-at-rest');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('164.312(a)(2)(iv)');
      expect(v[0].severity).toBe('high'); // Addressable, not critical
    });

    it('does not flag encrypted PHI access', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent()]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-encryption-at-rest');
      expect(v).toHaveLength(0);
    });
  });

  describe('PHI Encryption in Transit — §164.312(e)(2)(ii) (Addressable)', () => {
    it('flags PHI data flow without encryption', async () => {
      const { manager: m, violations } = setupTenantWithHipaa();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        encryptionState: 'plaintext',
        metadata: { 'comply.flow.from': 'patient-api', 'comply.flow.to': 'analytics' },
      })]);
      await new Promise(resolve => setTimeout(resolve, 50));

      const v = violations.filter(v => v.policyId === 'hipaa-phi-encryption-in-transit');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('164.312(e)(2)(ii)');
      expect(v[0].severity).toBe('high'); // Addressable
    });
  });
});
