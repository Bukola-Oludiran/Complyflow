import { describe, it, expect, afterEach } from 'vitest';
import { TenantManager } from '@complyflow/graph-builder';
import { GDPR_POLICIES } from '../frameworks/gdpr/index.js';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

function makeEvent(overrides: Partial<ComplianceEvent> = {}): ComplianceEvent {
  return {
    tenantId: 'tenant-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    timestamp: Date.now(),
    eventType: 'data-access',
    service: 'user-api',
    resource: 'postgres:users.email',
    action: 'read',
    actor: { userId: 'user-1', role: 'support' },
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
  for (const p of GDPR_POLICIES) {
    manager.addPolicyNode('tenant-1', p.nodeId, p.definition, p.acceptsTypes);
  }
  return { manager, violations };
}

describe('GDPR Policies', () => {
  let manager: TenantManager;
  afterEach(async () => { if (manager) await manager.shutdown(); });

  describe('Article 32 — Security of Processing', () => {
    it('flags personal data accessed without encryption', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ encryptionState: 'plaintext' })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'gdpr-art32-security' && v.ruleId === 'Article 32.1(a)');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].framework).toBe('GDPR');
    });

    it('flags personal data accessed without user identification', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ actor: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'gdpr-art32-security' && v.ruleId === 'Article 32.1(b)');
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('flags personal data flow without encryption', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        encryptionState: 'plaintext',
        metadata: { 'comply.flow.from': 'api', 'comply.flow.to': 'backup' },
      })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'gdpr-art32-security');
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag non-personal data', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        dataClassification: 'internal',
        encryptionState: 'plaintext',
        actor: {},
      })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.framework === 'GDPR');
      expect(v).toHaveLength(0);
    });
  });

  describe('Article 5 — Data Processing Principles', () => {
    it('flags personal data access without audit logging', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'gdpr-art5-principles');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('Article 5.1(f)');
    });
  });
});
