// Public API
export type {
  Message,
  PermissionManifest,
  NodeComponent,
  NodeDefinition,
  NodeContext,
  IncomingMessage,
  EmitFunction,
  EmitOptions,
  ChildRef,
  ComposeSpec,
  SetStateAction,
  Reducer,
  GraphReactRuntime,
  ChannelPolicy,
  AsyncEffectCallback,
  AsyncEffectCleanup,
  AsyncMessageHandler,
  TopologyEvent,
  TopologyHandler,
  TopologyFilterOptions,
} from './types.js';

// Graph engine
export { CommunicationGraph } from './graph/graph.js';
export type { GraphReactNodeAttributes, GraphReactEdgeAttributes } from './graph/attributes.js';
export { SubgraphView, subgraphByNodes, subgraphView } from './graph/views.js';
export { toJSON, fromJSON, toGraphML } from './graph/serialization.js';
export type { JsonGraph } from './graph/serialization.js';

// Algorithms
export {
  bfsEdges, bfsNodes, dfsEdges, dfsNodes,
  findCycle, hasCycle,
  connectedComponents, isConnected, numberOfConnectedComponents,
  areConnected, listEdges, listEdgesBetween, listEdgesOf, connectedPairs,
  shortestPath, allPaths, aStarPath,
} from './algorithms/index.js';
export type { EdgeInfo, EdgeFilter, PathHeuristic, PathOptions, AllPathsOptions, AStarOptions } from './algorithms/index.js';
export { topologicalSort, topologicalGenerations } from './algorithms/dag.js';

// Runtime
export { NodeInstance } from './runtime/node-instance.js';
export { Scheduler } from './runtime/scheduler.js';
export { evaluateNode, evaluateNodeAsync, unmountNode, unmountNodeAsync } from './runtime/lifecycle.js';
export {
  useState, useReducer, useEffect, useMemo, useCallback,
  useMessage, useEmit,
  useNeighbors, useGraphQuery,
  useSource,
  useTopology,
  flushEffectsAsync, cleanupEffectsAsync,
} from './runtime/hooks.js';
export type { EventSource, EventSourceFactory } from './runtime/sources.js';
export { GraphDirectory, buildDirectory } from './runtime/directory.js';
export type { DirectoryEntry } from './runtime/directory.js';
export { getTransform, registerTransform, listTransforms } from './runtime/transforms.js';
export type { TransformFn } from './runtime/transforms.js';
export { resolveChannelPolicy } from './runtime/permissions.js';
export type { ResolvedPolicy } from './runtime/permissions.js';
export { timerSource, delaySource, httpSource, watchSource } from './runtime/sources.js';
export { DEFAULT_TTL, MAX_PROCESS_DEPTH } from './runtime/constants.js';

// DSL
export { defineNode } from './dsl/define-node.js';
export { createGraph } from './dsl/create-graph.js';
export { loadGraph, loadGraphAsync } from './dsl/load-graph.js';
export { validateGraph } from './dsl/validation.js';
export type { ValidationWarning } from './dsl/validation.js';

// Parser
export { Parser } from './parser/parser.js';
export { compile } from './parser/compiler.js';
export { registerComponent, clearRegistry } from './parser/registry.js';
export type { GraphDecl, NodeDecl, EdgeDecl, GrxNode } from './parser/ast.js';
export { GrxParseError } from './parser/errors.js';
export type { GrxFile, ImportDirective, NodeDefinitionBlock } from './parser/ast.js';

// Transpiler
export { transpile } from './transpiler/transpile.js';

// Errors
export {
  GraphReactError,
  GraphError,
  RuntimeError,
  MaxProcessingDepthError,
  PermissionError,
  ValidationError,
} from './errors.js';
