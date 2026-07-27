import { describe, it, expect, afterEach } from 'vitest';
import { TenantManager } from '@complyflow/graph-builder';
import { PCI_POLICIES } from '../frameworks/pci-dss/index.js';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

function makeEvent(overrides: Partial<ComplianceEvent> = {}): ComplianceEvent {
  return {
    tenantId: 'tenant-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    timestamp: Date.now(),
    eventType: 'data-access',
    service: 'payment-api',
    resource: 'postgres:cards',
    action: 'read',
    actor: { userId: 'user-1', role: 'processor' },
    dataClassification: 'PCI',
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
  for (const p of PCI_POLICIES) {
    manager.addPolicyNode('tenant-1', p.nodeId, p.definition, p.acceptsTypes);
  }
  return { manager, violations };
}

describe('PCI-DSS Policies', () => {
  let manager: TenantManager;
  afterEach(async () => { if (manager) await manager.shutdown(); });

  describe('Req 3 — Protect Stored Data', () => {
    it('flags cardholder data stored without encryption', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ encryptionState: 'plaintext' })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'pci-req3-protect-stored');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].framework).toBe('PCI-DSS');
      expect(v[0].ruleId).toBe('Req 3.5');
      expect(v[0].severity).toBe('critical');
    });

    it('does not flag non-PCI data', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        dataClassification: 'PII',
        encryptionState: 'plaintext',
      })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.framework === 'PCI-DSS');
      expect(v).toHaveLength(0);
    });
  });

  describe('Req 4 — Protect Data in Transit', () => {
    it('flags cardholder data transmitted without encryption', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({
        eventType: 'data-flow',
        encryptionState: 'plaintext',
        metadata: { 'comply.flow.from': 'payment-api', 'comply.flow.to': 'processor' },
      })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'pci-req4-protect-transit');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('Req 4.2.1');
    });
  });

  describe('Req 7+8 — Access Control + Auth', () => {
    it('flags cardholder data access without user ID', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ actor: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'pci-req7-8-access');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('Req 8.2');
    });
  });

  describe('Req 10 — Logging', () => {
    it('flags cardholder data access without audit logging', async () => {
      const { manager: m, violations } = setup();
      manager = m;

      manager.routeEvents('tenant-1', [makeEvent({ metadata: {} })]);
      await new Promise(r => setTimeout(r, 50));

      const v = violations.filter(v => v.policyId === 'pci-req10-logging');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].ruleId).toBe('Req 10.2');
    });
  });
});
