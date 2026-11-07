import type { CytoscapeElements, ViolationsResponse, StatusResponse } from '../types/api';

/**
 * Base URL of the ComplyFlow REST API. Baked at build time via Vite env vars.
 * When unset, requests go to this origin's /api, which the Vite dev and
 * preview servers proxy to the local API (see vite.config.ts).
 */
export const API_BASE_URL =
    (import.meta.env.VITE_COMPLYFLOW_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function authedFetch(path: string, tenantId: string): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'x-complyflow-tenant-id': tenantId,
        },
    });
    return res;
}

export async function getTopology(tenantId: string): Promise<CytoscapeElements> {
    const res = await authedFetch('/api/v1/topology', tenantId);
    if (!res.ok) {
        if (res.status === 404) return { nodes: [], edges: [] };
        throw new Error(`Topology fetch failed: ${res.status}`);
    }
    return res.json();
}

export async function getGraph(tenantId: string): Promise<CytoscapeElements> {
    const res = await authedFetch('/api/v1/graph', tenantId);
    if (!res.ok) {
        if (res.status === 404) return { nodes: [], edges: [] };
        throw new Error(`Graph fetch failed: ${res.status}`);
    }
    return res.json();
}

export async function getViolations(tenantId: string, limit = 50): Promise<ViolationsResponse> {
    const res = await authedFetch(`/api/v1/violations?limit=${limit}`, tenantId);
    if (!res.ok) {
        if (res.status === 404) return { violations: [], total: 0 };
        throw new Error(`Violations fetch failed: ${res.status}`);
    }
    return res.json();
}

export async function getStatus(tenantId: string): Promise<StatusResponse | null> {
    const res = await authedFetch('/api/v1/status', tenantId);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Status fetch failed: ${res.status}`);
    }
    return res.json();
}
