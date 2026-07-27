import { OtlpReceiver } from '@complyflow/ingestion';
import { TenantManager } from '@complyflow/graph-builder';
import { ALL_POLICIES } from '@complyflow/policy-engine';
import { ApiServer } from './server.js';
import { ViolationStore } from './services/violation-store.js';

const OTLP_PORT = Number(process.env.COMPLYFLOW_OTLP_PORT ?? 4318);
const API_PORT = Number(process.env.COMPLYFLOW_API_PORT ?? 3000);
const HOST = process.env.COMPLYFLOW_HOST ?? '127.0.0.1';

const store = new ViolationStore();
const provisionedTenants = new Set<string>();

const manager = new TenantManager({
  onViolation: (_tenantId, violation) => {
    store.add(violation);
    console.log(`[violation] ${violation.framework} ${violation.ruleId} — ${violation.title} (${violation.service})`);
  },
});

function provisionTenant(tenantId: string): void {
  if (provisionedTenants.has(tenantId)) return;
  for (const policy of ALL_POLICIES) {
    manager.addPolicyNode(tenantId, policy.nodeId, policy.definition, policy.acceptsTypes);
  }
  provisionedTenants.add(tenantId);
  console.log(`[tenant] Provisioned "${tenantId}" with ${ALL_POLICIES.length} policies`);
}

const receiver = new OtlpReceiver({
  port: OTLP_PORT,
  host: HOST,
  onEvents: (tenantId, events) => {
    provisionTenant(tenantId);
    manager.routeEvents(tenantId, events);
    console.log(`[ingest] ${tenantId}: ${events.length} event(s) from ${events[0]?.service ?? 'unknown'}`);
  },
});

const api = new ApiServer({
  port: API_PORT,
  host: HOST,
  tenantManager: manager,
  violationStore: store,
});

async function start(): Promise<void> {
  await receiver.start();
  await api.start();

  console.log('');
  console.log('ComplyFlow Dev Server');
  console.log(`  OTLP ingestion: http://${HOST}:${OTLP_PORT}/v1/traces`);
  console.log(`  REST API:       http://${HOST}:${API_PORT}/api/v1/`);
  console.log(`  Policies:       ${ALL_POLICIES.length} (HIPAA, SOC 2, GDPR, PCI-DSS)`);
  console.log(`  Auto-provisioning tenants on first request`);
  console.log('');
}

async function shutdown(): Promise<void> {
  console.log('\nShutting down...');
  await api.stop();
  await receiver.stop();
  await manager.shutdown();
  console.log('Done.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
