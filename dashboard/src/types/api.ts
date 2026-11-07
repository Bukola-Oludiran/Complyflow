/** Shape of nodes/edges returned by ComplyFlow's /api/v1/topology and /api/v1/graph. */
export interface CytoscapeNode {
    data: { id: string; [key: string]: unknown };
}
export interface CytoscapeEdge {
    data: { source: string; target: string; [key: string]: unknown };
}
export interface CytoscapeElements {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
}

/** Shape of /api/v1/violations response. */
export interface ComplianceViolation {
    id: string;
    tenantId: string;
    framework: string;
    ruleId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description?: string;
    service?: string;
    resource?: string;
    detectedAt: number;
}

export interface ViolationsResponse {
    violations: ComplianceViolation[];
    total: number;
}

/** Shape of /api/v1/status response. */
export interface StatusResponse {
    tenantId: string;
    active: boolean;
    violations: {
        total: number;
        byFramework: Record<string, number>;
        bySeverity: Record<string, number>;
    };
}
