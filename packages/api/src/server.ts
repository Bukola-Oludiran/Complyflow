import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import type { ComplianceFramework, ViolationSeverity } from '@complyflow/shared';
import type { TenantManager } from '@complyflow/graph-builder';
import { ViolationStore } from './services/violation-store.js';
import { graphToCytoscapeElements, topologyToCytoscapeElements } from './services/graph-export.js';

export interface ApiServerOptions {
  port: number;
  host?: string;
  tenantManager: TenantManager;
  violationStore: ViolationStore;
}

/**
 * REST API server for ComplyFlow.
 *
 * Endpoints:
 *   GET /api/v1/violations?framework=&severity=&limit=&offset=
 *   GET /api/v1/status
 *   GET /api/v1/graph
 */
export class ApiServer {
  private server: Server | null = null;
  private options: ApiServerOptions;

  constructor(options: ApiServerOptions) {
    this.options = options;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(this.options.port, this.options.host ?? '0.0.0.0', () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Extract tenant ID from header
    const tenantId = req.headers['x-complyflow-tenant-id'] as string | undefined;
    if (!tenantId) {
      this.sendJson(res, 401, { error: 'Missing x-complyflow-tenant-id header' });
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'GET' && path === '/api/v1/violations') {
      this.handleViolations(tenantId, url, res);
    } else if (req.method === 'GET' && path === '/api/v1/status') {
      this.handleStatus(tenantId, res);
    } else if (req.method === 'GET' && path === '/api/v1/graph') {
      this.handleGraph(tenantId, res);
    } else if (req.method === 'GET' && path === '/api/v1/topology') {
      this.handleTopology(tenantId, res);
    } else {
      this.sendJson(res, 404, { error: 'Not found' });
    }
  }

  private handleViolations(tenantId: string, url: URL, res: ServerResponse): void {
    const violations = this.options.violationStore.query({
      tenantId,
      framework: url.searchParams.get('framework') as ComplianceFramework | undefined ?? undefined,
      severity: url.searchParams.get('severity') as ViolationSeverity | undefined ?? undefined,
      service: url.searchParams.get('service') ?? undefined,
      resource: url.searchParams.get('resource') ?? undefined,
      limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });

    this.sendJson(res, 200, {
      violations,
      total: this.options.violationStore.count(tenantId),
    });
  }

  private handleStatus(tenantId: string, res: ServerResponse): void {
    const store = this.options.violationStore;
    const tenant = this.options.tenantManager.get(tenantId);

    this.sendJson(res, 200, {
      tenantId,
      active: !!tenant,
      violations: {
        total: store.count(tenantId),
        byFramework: store.countByFramework(tenantId),
        bySeverity: store.countBySeverity(tenantId),
      },
    });
  }

  private handleGraph(tenantId: string, res: ServerResponse): void {
    const graph = this.options.tenantManager.getTenantGraph(tenantId);
    if (!graph) {
      this.sendJson(res, 404, { error: 'Tenant graph not found' });
      return;
    }

    const elements = graphToCytoscapeElements(graph);
    this.sendJson(res, 200, elements);
  }

  private handleTopology(tenantId: string, res: ServerResponse): void {
    const graph = this.options.tenantManager.getTenantGraph(tenantId);
    if (!graph) {
      this.sendJson(res, 404, { error: 'Tenant graph not found' });
      return;
    }

    const elements = topologyToCytoscapeElements(graph);
    this.sendJson(res, 200, elements);
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}
