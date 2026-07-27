import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OtlpReceiver } from '@complyflow/ingestion';
import { TenantManager } from '@complyflow/graph-builder';
import { HIPAA_POLICIES } from '@complyflow/policy-engine';
import { ApiServer, ViolationStore } from '@complyflow/api';
import type { ComplianceViolation } from '@complyflow/shared';
import type { OtlpExportTraceServiceRequest } from '@complyflow/ingestion';

/**
 * End-to-end integration test:
 *
 * SDK (simulated OTLP export)
 *   → Ingestion (OTLP receiver + span transformer)
 *     → Graph Builder (tenant graph + event routing)
 *       → Policy Engine (HIPAA policy evaluation)
 *         → Violation Collector
 *           → API (query violations)
 */
describe('End-to-End: SDK → OTLP → Graph → Policy → Violation → API', () => {
  let receiver: OtlpReceiver;
  let manager: TenantManager;
  let apiServer: ApiServer;
  let store: ViolationStore;

  const OTLP_PORT = 14400;
  const API_PORT = 14401;

  beforeAll(async () => {
    // 1. Set up violation store
    store = new ViolationStore();

    // 2. Set up tenant manager with violation callback
    manager = new TenantManager({
      onViolation: (_tenantId, violation) => {
        store.add(violation);
      },
    });

    // 3. Register HIPAA policies for the test tenant
    for (const policy of HIPAA_POLICIES) {
      manager.addPolicyNode('test-tenant', policy.nodeId, policy.definition, policy.acceptsTypes);
    }

    // 4. Set up OTLP receiver that routes events to the tenant manager
    receiver = new OtlpReceiver({
      port: OTLP_PORT,
      host: '127.0.0.1',
      onEvents: (tenantId, events) => {
        manager.routeEvents(tenantId, events);
      },
    });
    await receiver.start();

    // 5. Set up API server
    apiServer = new ApiServer({
      port: API_PORT,
      host: '127.0.0.1',
      tenantManager: manager,
      violationStore: store,
    });
    await apiServer.start();
  });

  afterAll(async () => {
    await apiServer.stop();
    await receiver.stop();
    await manager.shutdown();
  });

  it('detects HIPAA violations from SDK telemetry and serves them via API', async () => {
    // Simulate what the SDK would send: an OTLP trace export
    // This represents a non-compliant PHI access:
    // - No authenticated user (no comply.actor.user_id)
    // - Plaintext (comply.encryption_state = plaintext)
    // - Not audit-logged (no auditLogged in metadata)
    const otlpPayload: OtlpExportTraceServiceRequest = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'patient-portal' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'complyflow-sdk' },
          spans: [{
            traceId: 'e2e-trace-001',
            spanId: 'e2e-span-001',
            name: 'comply.data-access',
            startTimeUnixNano: '1700000000000000000',
            endTimeUnixNano: '1700000001000000000',
            attributes: [
              { key: 'comply.event_type', value: { stringValue: 'data-access' } },
              { key: 'comply.resource', value: { stringValue: 'postgres:patients.medical_records' } },
              { key: 'comply.action', value: { stringValue: 'read' } },
              { key: 'comply.data_class', value: { stringValue: 'PHI' } },
              { key: 'comply.encryption_state', value: { stringValue: 'plaintext' } },
              // Intentionally missing: comply.actor.user_id, comply.actor.role
              // This should trigger access control + encryption + audit violations
            ],
          }],
        }],
      }],
    };

    // Send the OTLP export to the ingestion layer (simulating SDK → platform)
    const otlpResponse = await fetch(`http://127.0.0.1:${OTLP_PORT}/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-complyflow-api-key': 'test-api-key',
        'x-complyflow-tenant-id': 'test-tenant',
      },
      body: JSON.stringify(otlpPayload),
    });

    expect(otlpResponse.status).toBe(200);

    // Wait for the event to flow through:
    // Ingestion → IngressNode → PolicyHub → HIPAA Policies → ViolationCollector
    await new Promise(resolve => setTimeout(resolve, 200));

    // Query violations via the API
    const violationsResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/violations`, {
      headers: { 'x-complyflow-tenant-id': 'test-tenant' },
    });

    expect(violationsResponse.status).toBe(200);
    const violationsBody = await violationsResponse.json();

    // Should have violations from multiple HIPAA policies
    expect(violationsBody.violations.length).toBeGreaterThan(0);

    const violations = violationsBody.violations as ComplianceViolation[];

    // Verify access control violation (no authenticated user)
    const accessViolation = violations.find(v => v.policyId === 'hipaa-phi-access-control');
    expect(accessViolation).toBeDefined();
    expect(accessViolation!.framework).toBe('HIPAA');
    expect(accessViolation!.severity).toBe('critical');

    // Verify at-rest encryption violation (plaintext data-access)
    const encViolation = violations.find(v => v.policyId === 'hipaa-phi-encryption-at-rest');
    expect(encViolation).toBeDefined();
    expect(encViolation!.ruleId).toBe('164.312(a)(2)(iv)');

    // Verify audit logging violation (not audit-logged)
    const auditViolation = violations.find(v => v.policyId === 'hipaa-phi-audit-logging');
    expect(auditViolation).toBeDefined();
    expect(auditViolation!.ruleId).toBe('164.312(b)');

    // Check compliance status endpoint
    const statusResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/status`, {
      headers: { 'x-complyflow-tenant-id': 'test-tenant' },
    });
    const statusBody = await statusResponse.json();
    expect(statusBody.active).toBe(true);
    expect(statusBody.violations.byFramework.HIPAA).toBeGreaterThan(0);

    // Check graph export endpoint
    const graphResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/graph`, {
      headers: { 'x-complyflow-tenant-id': 'test-tenant' },
    });
    const graphBody = await graphResponse.json();
    expect(graphBody.nodes.length).toBeGreaterThan(0);

    // Verify HIPAA policy nodes are in the graph
    const nodeIds = graphBody.nodes.map((n: any) => n.data.id);
    expect(nodeIds).toContain('hipaa-phi-access-control');
    expect(nodeIds).toContain('hipaa-phi-audit-logging');
    expect(nodeIds).toContain('hipaa-phi-encryption-at-rest');
  });

  it('handles compliant events without generating violations', async () => {
    // Clear the store for this test
    store.clear();

    const otlpPayload: OtlpExportTraceServiceRequest = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'patient-portal' } },
          ],
        },
        scopeSpans: [{
          spans: [{
            traceId: 'e2e-trace-002',
            spanId: 'e2e-span-002',
            name: 'comply.data-access',
            startTimeUnixNano: '1700000000000000000',
            endTimeUnixNano: '1700000001000000000',
            attributes: [
              { key: 'comply.event_type', value: { stringValue: 'data-access' } },
              { key: 'comply.resource', value: { stringValue: 'postgres:patients.name' } },
              { key: 'comply.action', value: { stringValue: 'read' } },
              { key: 'comply.data_class', value: { stringValue: 'public' } }, // Not PHI
              { key: 'comply.actor.user_id', value: { stringValue: 'nurse-1' } },
              { key: 'comply.actor.role', value: { stringValue: 'nurse' } },
              { key: 'comply.encryption_state', value: { stringValue: 'encrypted' } },
            ],
          }],
        }],
      }],
    };

    await fetch(`http://127.0.0.1:${OTLP_PORT}/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-complyflow-api-key': 'test-api-key',
        'x-complyflow-tenant-id': 'test-tenant',
      },
      body: JSON.stringify(otlpPayload),
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const res = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/violations`, {
      headers: { 'x-complyflow-tenant-id': 'test-tenant' },
    });
    const body = await res.json();

    // Public data access by authenticated user with encryption = no violations
    expect(body.violations).toHaveLength(0);
  });
});
