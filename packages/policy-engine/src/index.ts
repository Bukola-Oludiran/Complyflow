// HIPAA
export {
  HipaaPhiAccessControl,
  HipaaPhiAuditLogging,
  HipaaPhiEncryptionAtRest,
  HipaaPhiEncryptionInTransit,
  HipaaPhiPersonAuth,
  HipaaPhiLoginMonitoring,
  HipaaPhiDataFlowPath,
  HipaaPhiAccessScope,
  HipaaPhiMinimumNecessary,
  HIPAA_POLICIES,
} from './frameworks/hipaa/index.js';

// SOC 2
export {
  Soc2CC6LogicalAccess,
  Soc2CC6Transmission,
  Soc2CC7Monitoring,
  SOC2_POLICIES,
} from './frameworks/soc2/index.js';

// GDPR
export {
  GdprArt32Security,
  GdprArt5Principles,
  GDPR_POLICIES,
} from './frameworks/gdpr/index.js';

// PCI-DSS
export {
  PciReq3ProtectStored,
  PciReq4ProtectTransit,
  PciReq78Access,
  PciReq10Logging,
  PCI_POLICIES,
} from './frameworks/pci-dss/index.js';

// Shared
export type { PolicyDefinition } from './frameworks/hipaa/index.js';

// All frameworks combined
import { HIPAA_POLICIES } from './frameworks/hipaa/index.js';
import { SOC2_POLICIES } from './frameworks/soc2/index.js';
import { GDPR_POLICIES } from './frameworks/gdpr/index.js';
import { PCI_POLICIES } from './frameworks/pci-dss/index.js';

export const ALL_POLICIES = [
  ...HIPAA_POLICIES,
  ...SOC2_POLICIES,
  ...GDPR_POLICIES,
  ...PCI_POLICIES,
];
