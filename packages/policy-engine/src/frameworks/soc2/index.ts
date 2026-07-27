import type { PolicyDefinition } from '../hipaa/index.js';
import { Soc2CC6LogicalAccess } from './cc6-logical-access.js';
import { Soc2CC6Transmission } from './cc6-transmission.js';
import { Soc2CC7Monitoring } from './cc7-monitoring.js';

export { Soc2CC6LogicalAccess } from './cc6-logical-access.js';
export { Soc2CC6Transmission } from './cc6-transmission.js';
export { Soc2CC7Monitoring } from './cc7-monitoring.js';

export const SOC2_POLICIES: PolicyDefinition[] = [
  { nodeId: 'soc2-cc6-logical-access', definition: Soc2CC6LogicalAccess, acceptsTypes: ['data-access'] },
  { nodeId: 'soc2-cc6-transmission', definition: Soc2CC6Transmission, acceptsTypes: ['data-flow'] },
  { nodeId: 'soc2-cc7-monitoring', definition: Soc2CC7Monitoring, acceptsTypes: ['data-access'] },
];
