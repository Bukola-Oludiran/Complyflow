import { createGraph, type Scheduler, type CommunicationGraph, type NodeDefinition } from 'graphreact';
import type { ComplianceEvent, ComplianceFramework, ComplianceViolation } from '@complyflow/shared';
import { IngressNode } from './node-definitions/ingress-node.js';
import { ViolationCollectorNode } from './node-definitions/violation-collector-node.js';
import { EdgeAgingScanner } from './node-definitions/edge-aging-scanner.js';

export interface TenantGraph {
  graph: CommunicationGraph;
  scheduler: Scheduler;
  enabledFrameworks: Set<ComplianceFramework>;
  pendingEventCount: number;
}

export interface TenantManagerOptions {
  onViolation?: (tenantId: string, violation: ComplianceViolation) => void;
  /**
   * Max number of in-flight events per tenant before new events are dropped.
   * Defaults to 10_000. Pass 0 or a negative number to disable (unbounded).
   */
  maxQueuedEvents?: number;
  /**
   * Called when events are dropped due to queue overflow. Useful for metrics
   * and alerting. Not called when `maxQueuedEvents <= 0`.
   */
  onOverflow?: (tenantId: string, droppedCount: number) => void;
}

const DEFAULT_MAX_QUEUED_EVENTS = 10_000;

/**
 * TenantManager — manages isolated GraphReact instances per tenant.
 *
 * Each tenant gets their own CommunicationGraph + Scheduler with:
 *   ingress-router → [policy-nodes] → violation-collector
 *
 * Policy nodes are added when frameworks are enabled.
 */
export class TenantManager {
  private tenants = new Map<string, TenantGraph>();
  private options: TenantManagerOptions;

  constructor(options: TenantManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Get or create a tenant's graph. Creates the seed topology on first access.
   */
  getOrCreate(tenantId: string): TenantGraph {
    let tenant = this.tenants.get(tenantId);
    if (!tenant) {
      tenant = this.createTenantGraph(tenantId);
      this.tenants.set(tenantId, tenant);
    }
    return tenant;
  }

  /**
   * Get an existing tenant graph, or null if not created yet.
   */
  get(tenantId: string): TenantGraph | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * Route compliance events to the correct tenant's graph.
   *
   * Returns the number of events that were dropped due to queue overflow.
   * Zero means all events were accepted. Non-zero means the tenant is
   * falling behind and new events were shed.
   */
  routeEvents(tenantId: string, events: ComplianceEvent[]): number {
    const tenant = this.getOrCreate(tenantId);
    const maxQueued = this.options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS;

    let dropped = 0;
    for (const event of events) {
      if (maxQueued > 0 && tenant.pendingEventCount >= maxQueued) {
        dropped++;
        continue;
      }
      tenant.pendingEventCount++;
      tenant.scheduler.send('ingress-router', event.eventType, event);
    }

    if (dropped > 0 && this.options.onOverflow) {
      this.options.onOverflow(tenantId, dropped);
    }
    return dropped;
  }

  /**
   * Add a policy node to a tenant's graph.
   * The policy node is connected: ingress-router → policyNode → violation-collector
   */
  addPolicyNode(
    tenantId: string,
    nodeId: string,
    definition: NodeDefinition,
    acceptsTypes: string[],
  ): void {
    const tenant = this.getOrCreate(tenantId);
    const { graph, scheduler } = tenant;

    // Add node and connect to violation-collector
    scheduler.addNodeAtRuntime(nodeId, definition, {}, ['violation-collector']);

    // Add filtered edge from ingress-router → policyNode
    if (acceptsTypes.length > 0) {
      graph.addEdge('ingress-router', nodeId, undefined, { filter: acceptsTypes });
    }
  }

  /**
   * Remove a tenant and stop its scheduler.
   */
  async removeTenant(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      await tenant.scheduler.stop();
      this.tenants.delete(tenantId);
    }
  }

  /**
   * Stop all tenant schedulers.
   */
  async shutdown(): Promise<void> {
    for (const [, tenant] of this.tenants) {
      await tenant.scheduler.stop();
    }
    this.tenants.clear();
  }

  /**
   * Get the list of active tenant IDs.
   */
  listTenants(): string[] {
    return [...this.tenants.keys()];
  }

  /**
   * Get the underlying graph for a tenant (for API/dashboard export).
   */
  getTenantGraph(tenantId: string): CommunicationGraph | undefined {
    return this.tenants.get(tenantId)?.graph;
  }

  private createTenantGraph(tenantId: string): TenantGraph {
    // Per-tenant violation callback closure
    const onViolation = this.options.onViolation
      ? (v: ComplianceViolation) => this.options.onViolation!(tenantId, v)
      : undefined;

    const { graph, scheduler } = createGraph(`tenant-${tenantId}`, (g) => {
      g.addNode('ingress-router', IngressNode);
      g.addNode('violation-collector', ViolationCollectorNode, { onViolation });
      g.addNode('edge-aging-scanner', EdgeAgingScanner, { intervalMs: 60_000 });
    });

    const tenant: TenantGraph = {
      graph,
      scheduler,
      enabledFrameworks: new Set(),
      pendingEventCount: 0,
    };

    // Decrement pending count when ingestion events are delivered or dropped.
    // External events (from routeEvents) enter the scheduler with from='__external__'.
    const onDelivered = scheduler.onMessageDelivered;
    scheduler.onMessageDelivered = (msg) => {
      if (msg.from === '__external__') tenant.pendingEventCount = Math.max(0, tenant.pendingEventCount - 1);
      onDelivered?.(msg);
    };
    const onDropped = scheduler.onMessageDropped;
    scheduler.onMessageDropped = (msg, reason) => {
      if (msg.from === '__external__') tenant.pendingEventCount = Math.max(0, tenant.pendingEventCount - 1);
      onDropped?.(msg, reason);
    };

    scheduler.start();

    return tenant;
  }
}
