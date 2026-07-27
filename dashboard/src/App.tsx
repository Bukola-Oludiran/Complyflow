import { useCallback, useState } from 'react';
import { Header } from './components/Header';
import { TopologyGraph } from './components/TopologyGraph';
import { ViolationsPanel } from './components/ViolationsPanel';
import { API_BASE_URL, getTopology, getViolations, getStatus } from './lib/api';
import { usePolling } from './lib/usePolling';

const POLL_INTERVAL_MS = 2000;
const DEFAULT_TENANT_ID =
    (import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined) ?? 'homeai-sandbox';

export function App() {
    const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);

    const fetchTopology = useCallback(() => getTopology(tenantId), [tenantId]);
    const fetchViolations = useCallback(() => getViolations(tenantId, 100), [tenantId]);
    const fetchStatus = useCallback(() => getStatus(tenantId), [tenantId]);

    const topology = usePolling(fetchTopology, POLL_INTERVAL_MS, tenantId.length > 0);
    const violations = usePolling(fetchViolations, POLL_INTERVAL_MS, tenantId.length > 0);
    const status = usePolling(fetchStatus, POLL_INTERVAL_MS, tenantId.length > 0);

    const elements = topology.data ?? { nodes: [], edges: [] };
    const violationsData = violations.data?.violations ?? [];
    const violationsTotal = violations.data?.total ?? 0;

    return (
        <div className="flex h-screen w-screen flex-col">
            <Header
                tenantId={tenantId}
                onTenantIdChange={setTenantId}
                status={status.data}
                lastUpdated={topology.lastUpdated}
                apiUrl={API_BASE_URL}
            />
            <main className="flex flex-1 overflow-hidden">
                <section className="flex-1 overflow-hidden">
                    <TopologyGraph elements={elements} />
                </section>
                <aside className="w-96 shrink-0 overflow-hidden">
                    <ViolationsPanel violations={violationsData} total={violationsTotal} />
                </aside>
            </main>
            {(topology.error || violations.error || status.error) && (
                <div className="border-t border-red-500/40 bg-red-500/10 px-4 py-1 text-xs text-red-300">
                    Error talking to ComplyFlow API: {(topology.error ?? violations.error ?? status.error)?.message}
                </div>
            )}
        </div>
    );
}
