// --- Compliance Event Types ---

/** Categories of compliance events the SDK can emit */
export type ComplianceEventType =
  | 'data-access'
  | 'access-control'
  | 'data-flow'
  | 'encryption'
  | 'audit-log';

/** Data sensitivity classification */
export type DataClassification = 'PII' | 'PHI' | 'PCI' | 'public' | 'internal';

/** Encryption state of data at the point of observation */
export type EncryptionState = 'encrypted' | 'plaintext' | 'tokenized';

/** Supported compliance frameworks */
export type ComplianceFramework = 'HIPAA' | 'SOC2' | 'PCI-DSS' | 'GDPR';

/** Violation severity levels */
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

/** The actor performing a compliance-relevant action */
export interface ComplianceActor {
  userId?: string;
  role?: string;
  service?: string;
}

/**
 * Normalized compliance event flowing through the platform.
 * SDK produces OTel spans with comply.* attributes.
 * Ingestion layer transforms those spans into this shape.
 */
export interface ComplianceEvent {
  tenantId: string;
  traceId: string;
  spanId: string;
  timestamp: number;
  eventType: ComplianceEventType;
  service: string;
  resource: string;
  action: string;
  actor: ComplianceActor;
  dataClassification?: DataClassification;
  encryptionState?: EncryptionState;
  metadata: Record<string, unknown>;
}

// --- Topology Types (Layer 2: auto-discovered system map) ---

/** Node type in the discovered topology */
export type TopologyNodeType = 'service' | 'resource';

/** Edge relationship types in the discovered topology */
export type TopologyEdgeType = 'accesses' | 'flows-to';

/** Attributes on topology edges (service→resource or service→service) */
export interface TopologyEdgeAttrs {
  edgeType: TopologyEdgeType;
  dataClassification?: DataClassification;
  encryptionState?: EncryptionState;
  lastSeen: number;
  firstSeen: number;
  accessCount: number;
}

/** Attributes on discovered service nodes */
export interface ServiceNodeAttrs {
  nodeType: 'service';
  serviceName: string;
  dataClassifications: DataClassification[];
  hasAuditLogging: boolean;
  lastSeen: number;
  eventCount: number;
}

/** Attributes on discovered resource nodes */
export interface ResourceNodeAttrs {
  nodeType: 'resource';
  resourceName: string;
  dataClassifications: DataClassification[];
  encryptionStates: EncryptionState[];
  lastSeen: number;
  accessCount: number;
}

/**
 * Violation emitted by policy nodes when a compliance rule is breached.
 */
export interface ComplianceViolation {
  id: string;
  tenantId: string;
  policyId: string;
  framework: ComplianceFramework;
  ruleId: string;
  severity: ViolationSeverity;
  title: string;
  description: string;
  evidence: ComplianceEvent[];
  detectedAt: number;
  resource: string;
  service: string;
}
