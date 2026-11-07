/**
 * Component registry — maps tag names to NodeDefinition instances.
 */

import type { NodeDefinition } from '../types.js';

const registry = new Map<string, NodeDefinition>();

export function registerComponent(name: string, definition: NodeDefinition): void {
  registry.set(name, definition);
}

export function getComponent(name: string): NodeDefinition | undefined {
  return registry.get(name);
}

export function hasComponent(name: string): boolean {
  return registry.has(name);
}

export function clearRegistry(): void {
  registry.clear();
}

export function getRegisteredNames(): string[] {
  return [...registry.keys()];
}
