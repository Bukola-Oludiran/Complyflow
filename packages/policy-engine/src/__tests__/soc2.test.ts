import { describe, it, expect, afterEach } from 'vitest';
import { TenantManager } from '@complyflow/graph-builder';
import { SOC2_POLICIES } from '../frameworks/soc2/index.js';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

function makeEvent(overrides: Partial<ComplianceEvent> = {}): ComplianceEvent {
  return {
    tenantId: 'tenant-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    timestamp: Date.now(),
    eventType: 'data-access',
    service: 'user-api',
    resource: 'postgres:users',
    action: 'read',
    actor: { userId: 'user-1', role: 'admin' },
    dataClassification: 'PII',
    encryptionState: 'encrypted',
    metadata: { auditLogged: true },
    ...overrides,
  };
}

function setup(): { manager: TenantManager; violations: ComplianceViolation[] } {
  const violations: ComplianceViolation[] = [];
  const manager = new TenantManager({
    onViolation: (_, v) => violations.push(v),
  });
  for (const p of SOC2_POLICIES) {
    manager.addPolicyNode('tenant-1', p.nodeId, p.definition, p.acceptsTypes);
  }
  return { manager, violations };
}

describe('SOC 2 Policies', () => {
  let manager: TenantManager;
  afterEach(async () => { if (manager) await manager.shutdown(); });

  describe('CC6.1 — Logical Access', () => {
    it('flags non-public data access without user ID', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ actor: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'soc2-cc6-logical-access' && v.title.includes('user identification'));
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].framework).toBe('SOC2');
      expect(v[0].ruleId).toBe('CC6.1');
    });

    it('flags non-public data accessed in plaintext', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ encryptionState: 'plaintext' })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'soc2-cc6-logical-access' && v.title.includes('encryption'));
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag public data', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ dataClassification: 'public', actor: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'soc2-cc6-logical-access');
      expect(v).toHaveLength(0);
    });
  });

  describe('CC6.7 — Transmission', () => {
    it('flags unencrypted data flow', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        encryptionState: 'plaintext',
        metadata: { 'comply.flow.from': 'api', 'comply.flow.to': 'analytics' },
      })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'soc2-cc6-transmission');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('CC6.7');
    });
  });

  describe('CC7.2 — Monitoring', () => {
    it('flags data access without audit logging', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'soc2-cc7-monitoring');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('CC7.2');
    });
  });
});
