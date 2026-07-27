import type { PolicyDefinition } from '../hipaa/index.js';
import { GdprArt32Security } from './art32-security.js';
import { GdprArt5Principles } from './art5-principles.js';

export { GdprArt32Security } from './art32-security.js';
export { GdprArt5Principles } from './art5-principles.js';

export const GDPR_POLICIES: PolicyDefinition[] = [
  { nodeId: 'gdpr-art32-security', definition: GdprArt32Security, acceptsTypes: ['data-access', 'data-flow'] },
  { nodeId: 'gdpr-art5-principles', definition: GdprArt5Principles, acceptsTypes: ['data-access'] },
];
