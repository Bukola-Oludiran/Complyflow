import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiServer } from '../server.js';
import { ViolationStore } from '../services/violation-store.js';
import { TenantManager } from '@complyflow/graph-builder';
import { HIPAA_POLICIES } from '@complyflow/policy-engine';
import type { ComplianceEvent, ComplianceViolation } from '@complyflow/shared';

describe('API Server', () => {
  let server: ApiServer;
  let store: ViolationStore;
  let manager: TenantManager;
  const PORT = 14321;

  beforeAll(async () => {
    store = new ViolationStore();
    manager = new TenantManager({
      onViolation: (_tenantId, violation) => {
        store.add(violation);
      },
    });

    // Register HIPAA policies for tenant-1
    for (const policy of HIPAA_POLICIES) {
      manager.addPolicyNode('tenant-1', policy.nodeId, policy.definition, policy.acceptsTypes);
    }

    server = new ApiServer({
      port: PORT,
      host: '127.0.0.1',
      tenantManager: manager,
      violationStore: store,
    });
    await server.start();

    // Send an event that triggers violations
    const event: ComplianceEvent = {
      tenantId: 'tenant-1',
      traceId: 'trace-1',
      spanId: 'span-1',
      timestamp: Date.now(),
      eventType: 'data-access',
      service: 'patient-api',
      resource: 'postgres:patients.ssn',
      action: 'read',
      actor: {}, // no userId — triggers access control violation
      dataClassification: 'PHI',
      encryptionState: 'plaintext', // triggers encryption violation
      metadata: {}, // no auditLogged — triggers audit violation
    };
    manager.routeEvents('tenant-1', [event]);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await server.stop();
    await manager.shutdown();
  });

  it('returns 401 without tenant header', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/violations`);
    expect(res.status).toBe(401);
  });

  it('returns violations for a tenant', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/violations`, {
      headers: { 'x-complyflow-tenant-id': 'tenant-1' },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.violations.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('filters violations by framework', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/violations?framework=HIPAA`, {
      headers: { 'x-complyflow-tenant-id': 'tenant-1' },
    });
    const body = await res.json();
    expect(body.violations.every((v: ComplianceViolation) => v.framework === 'HIPAA')).toBe(true);
  });

  it('returns compliance status', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/status`, {
      headers: { 'x-complyflow-tenant-id': 'tenant-1' },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tenantId).toBe('tenant-1');
    expect(body.active).toBe(true);
    expect(body.violations.total).toBeGreaterThan(0);
    expect(body.violations.byFramework.HIPAA).toBeGreaterThan(0);
  });

  it('returns graph topology as Cytoscape elements', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/graph`, {
      headers: { 'x-complyflow-tenant-id': 'tenant-1' },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.edges.length).toBeGreaterThan(0);

    // Verify seed topology nodes exist
    const nodeIds = body.nodes.map((n: any) => n.data.id);
    expect(nodeIds).toContain('ingress-router');
    expect(nodeIds).toContain('violation-collector');
  });

  it('returns 404 for unknown endpoints', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/unknown`, {
      headers: { 'x-complyflow-tenant-id': 'tenant-1' },
    });
    expect(res.status).toBe(404);
  });
});
