/**
 * Runtime constants — bit flags and defaults.
 * Inspired by Preact's constants.js.
 */

// Node state bit flags (stored on NodeInstance._bits)
export const NODE_DIRTY      = 1 << 0;  // Needs re-evaluation
export const NODE_PROCESSING = 1 << 1;  // Currently being evaluated
export const NODE_MOUNTED    = 1 << 2;  // Has completed first evaluation
export const NODE_UNMOUNTED  = 1 << 3;  // Has been removed

// Defaults
export const DEFAULT_TTL = 10;
export const MAX_PROCESS_DEPTH = 100;
