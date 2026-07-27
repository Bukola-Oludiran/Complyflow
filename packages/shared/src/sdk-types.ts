import type { DataClassification, EncryptionState, ComplianceActor } from './types.js';

/** Configuration for comply.init() */
export interface ComplyFlowConfig {
  apiKey: string;
  tenantId: string;
  endpoint: string;
  serviceName?: string;
}

/** Input for comply.dataAccess() */
export interface DataAccessInput {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'list';
  dataClassification?: DataClassification;
  actor?: ComplianceActor;
  encrypted?: boolean;
  reason?: string;
  /** Number of records touched in a bulk operation (default: 1) */
  recordCount?: number;
  /** Why a bulk operation occurred (e.g., 'monthly-report', 'data-migration') */
  batchReason?: string;
}

/** Input for comply.accessControl() */
export interface AccessControlInput {
  resource: string;
  actor: ComplianceActor;
  granted: boolean;
  method?: 'rbac' | 'abac' | 'acl' | 'custom';
  mfaVerified?: boolean;
  dataClassification?: DataClassification;
}

/** Input for comply.dataFlow() */
export interface DataFlowInput {
  from: string;
  to: string;
  dataClassification?: DataClassification;
  transformed?: boolean;
  transformationType?: string;
  encrypted?: boolean;
}
