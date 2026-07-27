import { describe, it, expect, afterEach } from 'vitest';
import { TenantManager } from '../topology-manager.js';
import { makeServiceId } from '../node-definitions/service-node.js';
import { makeResourceId } from '../node-definitions/resource-node.js';
import type { ComplianceEvent } from '@complyflow/shared';

function makeEvent(overrides: Partial<ComplianceEvent> = {}): ComplianceEvent {
  return {
    tenantId: 'tenant-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    timestamp: 1700000000000,
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

describe('IngressNode topology auto-discovery', () => {
  let manager: TenantManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('creates service and resource nodes from data-access events', async () => {
    manager = new TenantManager();
    manager.routeEvents('tenant-1', [makeEvent()]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const svcId = makeServiceId('patient-api');
    const resId = makeResourceId('postgres:patients');

    expect(graph.hasNode(svcId)).toBe(true);
    expect(graph.hasNode(resId)).toBe(true);

    // Check service attributes
    const svcAttrs = graph.getNodeData(svcId);
    expect(svcAttrs.nodeType).toBe('service');
    expect(svcAttrs.serviceName).toBe('patient-api');
    expect(svcAttrs.dataClassifications).toContain('PHI');
    expect(svcAttrs.hasAuditLogging).toBe(true);

    // Check resource attributes
    const resAttrs = graph.getNodeData(resId);
    expect(resAttrs.nodeType).toBe('resource');
    expect(resAttrs.resourceName).toBe('postgres:patients');
    expect(resAttrs.dataClassifications).toContain('PHI');
    expect(resAttrs.encryptionStates).toContain('encrypted');
  });

  it('creates accesses edge between service and resource', async () => {
    manager = new TenantManager();
    manager.routeEvents('tenant-1', [makeEvent()]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const svcId = makeServiceId('patient-api');
    const resId = makeResourceId('postgres:patients');

    expect(graph.hasEdge(svcId, resId)).toBe(true);

    const edgeData = graph.getEdgeData(svcId, resId);
    expect(edgeData.edgeType).toBe('accesses');
    expect(edgeData.dataClassification).toBe('PHI');
    expect(edgeData.encryptionState).toBe('encrypted');
    expect(edgeData.accessCount).toBe(1);
  });

  it('creates flows-to edge between services from data-flow events', async () => {
    manager = new TenantManager();
    manager.routeEvents('tenant-1', [makeEvent({
      eventType: 'data-flow',
      service: 'patient-api',
      metadata: {
        'comply.flow.from': 'patient-api',
        'comply.flow.to': 'analytics-pipeline',
      },
      dataClassification: 'PHI',
      encryptionState: 'plaintext',
    })]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const fromId = makeServiceId('patient-api');
    const toId = makeServiceId('analytics-pipeline');

    expect(graph.hasNode(fromId)).toBe(true);
    expect(graph.hasNode(toId)).toBe(true);
    expect(graph.hasEdge(fromId, toId)).toBe(true);

    const edgeData = graph.getEdgeData(fromId, toId);
    expect(edgeData.edgeType).toBe('flows-to');
    expect(edgeData.dataClassification).toBe('PHI');
    expect(edgeData.encryptionState).toBe('plaintext');
  });

  it('updates edge attributes on subsequent events', async () => {
    manager = new TenantManager();

    // First event
    manager.routeEvents('tenant-1', [makeEvent({ timestamp: 1000 })]);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Second event to same service/resource
    manager.routeEvents('tenant-1', [makeEvent({ timestamp: 2000 })]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const svcId = makeServiceId('patient-api');
    const resId = makeResourceId('postgres:patients');

    const edgeData = graph.getEdgeData(svcId, resId);
    expect(edgeData.accessCount).toBe(2);
    expect(edgeData.lastSeen).toBe(2000);
    expect(edgeData.firstSeen).toBe(1000);
  });

  it('preserves true firstSeen when events arrive out of order', async () => {
    manager = new TenantManager();

    // E1 has timestamp=2000 but arrives first (creates the edge)
    manager.routeEvents('tenant-1', [makeEvent({ timestamp: 2000 })]);
    await new Promise(resolve => setTimeout(resolve, 50));

    // E2 has timestamp=1000 (older) but arrives second (network reordering)
    manager.routeEvents('tenant-1', [makeEvent({ timestamp: 1000 })]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const svcId = makeServiceId('patient-api');
    const resId = makeResourceId('postgres:patients');

    const edgeData = graph.getEdgeData(svcId, resId);
    // firstSeen should reflect the actual earliest timestamp (1000),
    // not the arrival order (2000)
    expect(edgeData.firstSeen).toBe(1000);
    // lastSeen should stay at the latest observed timestamp (2000)
    expect(edgeData.lastSeen).toBe(2000);
    expect(edgeData.accessCount).toBe(2);
  });

  it('does not create duplicate nodes for repeated service names', async () => {
    manager = new TenantManager();

    manager.routeEvents('tenant-1', [
      makeEvent({ timestamp: 1000 }),
      makeEvent({ timestamp: 2000 }),
      makeEvent({ timestamp: 3000 }),
    ]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const svcId = makeServiceId('patient-api');

    // Should exist exactly once
    expect(graph.hasNode(svcId)).toBe(true);

    // eventCount should reflect all events
    const attrs = graph.getNodeData(svcId);
    expect(attrs.eventCount).toBe(3);
  });

  it('accumulates multiple data classifications on a resource', async () => {
    manager = new TenantManager();

    manager.routeEvents('tenant-1', [
      makeEvent({ dataClassification: 'PHI' }),
      makeEvent({ dataClassification: 'PII' }),
    ]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;
    const resId = makeResourceId('postgres:patients');
    const attrs = graph.getNodeData(resId);

    expect(attrs.dataClassifications).toContain('PHI');
    expect(attrs.dataClassifications).toContain('PII');
  });

  it('builds multi-service topology from mixed events', async () => {
    manager = new TenantManager();

    manager.routeEvents('tenant-1', [
      // patient-api reads from postgres
      makeEvent({
        service: 'patient-api',
        resource: 'postgres:patients',
        dataClassification: 'PHI',
      }),
      // patient-api writes to redis cache
      makeEvent({
        service: 'patient-api',
        resource: 'redis:session-cache',
        dataClassification: 'internal',
        encryptionState: 'plaintext',
      }),
      // data flows from patient-api to analytics
      makeEvent({
        eventType: 'data-flow',
        service: 'patient-api',
        resource: '',
        metadata: {
          'comply.flow.from': 'patient-api',
          'comply.flow.to': 'analytics-pipeline',
        },
        dataClassification: 'PHI',
        encryptionState: 'plaintext',
      }),
    ]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const graph = manager.getTenantGraph('tenant-1')!;

    // 3 services, 2 resources
    expect(graph.hasNode(makeServiceId('patient-api'))).toBe(true);
    expect(graph.hasNode(makeServiceId('analytics-pipeline'))).toBe(true);
    expect(graph.hasNode(makeResourceId('postgres:patients'))).toBe(true);
    expect(graph.hasNode(makeResourceId('redis:session-cache'))).toBe(true);

    // 2 accesses edges + 1 flows-to edge
    expect(graph.hasEdge(makeServiceId('patient-api'), makeResourceId('postgres:patients'))).toBe(true);
    expect(graph.hasEdge(makeServiceId('patient-api'), makeResourceId('redis:session-cache'))).toBe(true);
    expect(graph.hasEdge(makeServiceId('patient-api'), makeServiceId('analytics-pipeline'))).toBe(true);
  });
});
