import type { PolicyDefinition } from '../hipaa/index.js';
import { PciReq3ProtectStored } from './req3-protect-stored.js';
import { PciReq4ProtectTransit } from './req4-protect-transit.js';
import { PciReq78Access } from './req7-8-access.js';
import { PciReq10Logging } from './req10-logging.js';

export { PciReq3ProtectStored } from './req3-protect-stored.js';
export { PciReq4ProtectTransit } from './req4-protect-transit.js';
export { PciReq78Access } from './req7-8-access.js';
export { PciReq10Logging } from './req10-logging.js';

export const PCI_POLICIES: PolicyDefinition[] = [
  { nodeId: 'pci-req3-protect-stored', definition: PciReq3ProtectStored, acceptsTypes: ['data-access'] },
  { nodeId: 'pci-req4-protect-transit', definition: PciReq4ProtectTransit, acceptsTypes: ['data-flow'] },
  { nodeId: 'pci-req7-8-access', definition: PciReq78Access, acceptsTypes: ['data-access', 'access-control'] },
  { nodeId: 'pci-req10-logging', definition: PciReq10Logging, acceptsTypes: ['data-access'] },
];
