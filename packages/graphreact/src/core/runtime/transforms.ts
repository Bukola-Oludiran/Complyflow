/**
 * Edge transform registry — named transforms that modify messages in transit.
 *
 * Transforms are referenced by string in .grx edge attributes:
 *   <edge source="n0" target="n1" weight={0.8} transform="multiply-weight" />
 *
 * Custom transforms can be registered at runtime.
 */

import type { IncomingMessage } from '../types.js';
import type { EdgeAttributes } from '../types.js';

/** A transform function receives the message and edge attributes, returns modified message or null to drop */
export type TransformFn = (msg: IncomingMessage, edgeAttrs: EdgeAttributes) => IncomingMessage | null;

const registry = new Map<string, TransformFn>();

// --- Built-in transforms ---

/** Multiply payload.value by edge weight */
registry.set('multiply-weight', (msg, attrs) => {
  const weight = (attrs.weight as number) ?? 1;
  const payload = msg.payload as Record<string, unknown>;
  return {
    ...msg,
    payload: { ...payload, value: (payload.value as number) * weight },
  };
});

/** Attenuate payload.value by edge weight (same as multiply-weight, semantic alias) */
registry.set('attenuate', (msg, attrs) => {
  const weight = (attrs.weight as number) ?? 0.5;
  const payload = msg.payload as Record<string, unknown>;
  return {
    ...msg,
    payload: { ...payload, value: (payload.value as number) * weight },
  };
});

/** Amplify payload.value (multiply by 1/weight, so weight < 1 amplifies) */
registry.set('amplify', (msg, attrs) => {
  const weight = (attrs.weight as number) ?? 0.5;
  if (weight === 0) return msg;
  const payload = msg.payload as Record<string, unknown>;
  return {
    ...msg,
    payload: { ...payload, value: (payload.value as number) / weight },
  };
});

/** Add weight to payload.value */
registry.set('add-weight', (msg, attrs) => {
  const weight = (attrs.weight as number) ?? 0;
  const payload = msg.payload as Record<string, unknown>;
  return {
    ...msg,
    payload: { ...payload, value: (payload.value as number) + weight },
  };
});

/** Gate — drop message if payload.value is below a threshold (weight = threshold) */
registry.set('threshold-gate', (msg, attrs) => {
  const threshold = (attrs.weight as number) ?? 0;
  const payload = msg.payload as Record<string, unknown>;
  if ((payload.value as number) < threshold) return null;
  return msg;
});

// --- Registry API ---

export function getTransform(name: string): TransformFn | undefined {
  return registry.get(name);
}

export function registerTransform(name: string, fn: TransformFn): void {
  registry.set(name, fn);
}

export function listTransforms(): string[] {
  return [...registry.keys()];
}
