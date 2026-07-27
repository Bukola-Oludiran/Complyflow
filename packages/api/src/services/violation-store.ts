import type { ComplianceViolation, ComplianceFramework, ViolationSeverity } from '@complyflow/shared';

export interface ViolationQuery {
  tenantId: string;
  framework?: ComplianceFramework;
  severity?: ViolationSeverity;
  service?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}

/**
 * In-memory violation store. Replace with Postgres/SQLite for production.
 */
export class ViolationStore {
  private violations: ComplianceViolation[] = [];

  add(violation: ComplianceViolation): void {
    this.violations.push(violation);
  }

  query(query: ViolationQuery): ComplianceViolation[] {
    let results = this.violations.filter(v => v.tenantId === query.tenantId);

    if (query.framework) {
      results = results.filter(v => v.framework === query.framework);
    }
    if (query.severity) {
      results = results.filter(v => v.severity === query.severity);
    }
    if (query.service) {
      results = results.filter(v => v.service === query.service);
    }
    if (query.resource) {
      results = results.filter(v => v.resource === query.resource);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  count(tenantId: string): number {
    return this.violations.filter(v => v.tenantId === tenantId).length;
  }

  countByFramework(tenantId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const v of this.violations) {
      if (v.tenantId !== tenantId) continue;
      counts[v.framework] = (counts[v.framework] ?? 0) + 1;
    }
    return counts;
  }

  countBySeverity(tenantId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const v of this.violations) {
      if (v.tenantId !== tenantId) continue;
      counts[v.severity] = (counts[v.severity] ?? 0) + 1;
    }
    return counts;
  }

  clear(): void {
    this.violations = [];
  }
}
