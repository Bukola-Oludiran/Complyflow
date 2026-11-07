export { bfsEdges, bfsNodes, dfsEdges, dfsNodes } from './traversal.js';
export { findCycle, hasCycle } from './cycles.js';
export {
  connectedComponents,
  isConnected,
  numberOfConnectedComponents,
} from './components.js';
export {
  areConnected,
  listEdges,
  listEdgesBetween,
  listEdgesOf,
  connectedPairs,
} from './edges.js';
export type { EdgeInfo } from './edges.js';
export { topologicalSort, topologicalGenerations } from './dag.js';
export { shortestPath, allPaths, aStarPath } from './pathfinding.js';
export type { EdgeFilter, PathHeuristic, PathOptions, AllPathsOptions, AStarOptions } from './pathfinding.js';

// Linear algebra (WASM) — opt-in, call `await init()` before use.
export {
  default as initLinalg,
  initSync as initLinalgSync,
  svd,
  eigh,
  gemm,
  solve,
  normalize_rows,
  SvdResult,
  EighResult,
} from './linalg/index.js';
export type { InitInput, InitOutput, SyncInitInput } from './linalg/index.js';
