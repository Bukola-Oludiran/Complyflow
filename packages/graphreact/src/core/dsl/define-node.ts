/**
 * defineNode — creates a NodeDefinition from a name and component function.
 */

import type { NodeComponent, NodeDefinition } from '../types.js';

export function defineNode(name: string, component: NodeComponent): NodeDefinition {
  return { name, component };
}
