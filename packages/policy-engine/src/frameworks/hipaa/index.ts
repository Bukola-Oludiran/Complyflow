import type { NodeDefinition } from 'graphreact';
import { HipaaPhiAccessControl } from './phi-access-control.js';
import { HipaaPhiAuditLogging } from './phi-audit-logging.js';
import { HipaaPhiEncryptionAtRest } from './phi-encryption-at-rest.js';
import { HipaaPhiEncryptionInTransit } from './phi-encryption-in-transit.js';
import { HipaaPhiPersonAuth } from './phi-person-auth.js';
import { HipaaPhiLoginMonitoring } from './phi-login-monitoring.js';
import { HipaaPhiDataFlowPath } from './phi-data-flow-path.js';
import { HipaaPhiAccessScope } from './phi-access-scope.js';
import { HipaaPhiMinimumNecessary } from './phi-minimum-necessary.js';

export { HipaaPhiAccessControl } from './phi-access-control.js';
export { HipaaPhiAuditLogging } from './phi-audit-logging.js';
export { HipaaPhiEncryptionAtRest } from './phi-encryption-at-rest.js';
export { HipaaPhiEncryptionInTransit } from './phi-encryption-in-transit.js';
export { HipaaPhiPersonAuth } from './phi-person-auth.js';
export { HipaaPhiLoginMonitoring } from './phi-login-monitoring.js';
export { HipaaPhiDataFlowPath } from './phi-data-flow-path.js';
export { HipaaPhiAccessScope } from './phi-access-scope.js';
export { HipaaPhiMinimumNecessary } from './phi-minimum-necessary.js';

export interface PolicyDefinition {
  nodeId: string;
  definition: NodeDefinition;
  acceptsTypes: string[];
}

/**
 * All HIPAA policy definitions, mapped to actual 45 CFR regulation sections.
 *
 * Required specs: severity 'critical' or 'high'
 * Addressable specs: severity 'high' or 'medium', descriptions include §164.306(d)(3) caveat
 * Topology-only policies have empty acceptsTypes (react via useTopology, not events)
 */
export const HIPAA_POLICIES: PolicyDefinition[] = [
  // === Layer 1: Stateless event-by-event policies ===

  // §164.312(a)(2)(i) — Unique User Identification (Required)
  {
    nodeId: 'hipaa-phi-access-control',
    definition: HipaaPhiAccessControl,
    acceptsTypes: ['data-access'],
  },
  // §164.312(b) — Audit Controls (Required)
  {
    nodeId: 'hipaa-phi-audit-logging',
    definition: HipaaPhiAuditLogging,
    acceptsTypes: ['data-access'],
  },
  // §164.312(a)(2)(iv) — Encryption and Decryption at rest (Addressable)
  {
    nodeId: 'hipaa-phi-encryption-at-rest',
    definition: HipaaPhiEncryptionAtRest,
    acceptsTypes: ['data-access'],
  },
  // §164.312(e)(2)(ii) — Transmission Encryption (Addressable)
  {
    nodeId: 'hipaa-phi-encryption-in-transit',
    definition: HipaaPhiEncryptionInTransit,
    acceptsTypes: ['data-flow'],
  },
  // §164.312(d) — Person or Entity Authentication (Required)
  {
    nodeId: 'hipaa-phi-person-auth',
    definition: HipaaPhiPersonAuth,
    acceptsTypes: ['access-control'],
  },
  // §164.308(a)(5)(ii)(C) — Log-in Monitoring (Addressable)
  {
    nodeId: 'hipaa-phi-login-monitoring',
    definition: HipaaPhiLoginMonitoring,
    acceptsTypes: ['access-control'],
  },

  // === Layer 2: Topology-aware policies ===

  // §164.312(e)(2)(ii) — Transmission Encryption topology check (Addressable)
  {
    nodeId: 'hipaa-phi-data-flow-path',
    definition: HipaaPhiDataFlowPath,
    acceptsTypes: ['data-flow'],
  },
  // §164.312(b) — Audit Controls topology check (Required)
  {
    nodeId: 'hipaa-phi-access-scope',
    definition: HipaaPhiAccessScope,
    acceptsTypes: [],
  },
  // §164.502(b) — Minimum Necessary (Privacy Rule)
  {
    nodeId: 'hipaa-phi-minimum-necessary',
    definition: HipaaPhiMinimumNecessary,
    acceptsTypes: [],
  },
];
