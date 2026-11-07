/**
 * Compiler — transforms a .grx AST into a CommunicationGraph + NodeInstances.
 *
 * Handles:
 *  - Node creation (first occurrence of an id)
 *  - Multi-parent edges (duplicate id = connect to new parent)
 *  - Parent-child edges from nesting
 *  - Explicit <edge> declarations
 *  - Component resolution via registry
 */

import type { GraphDecl, GrxNode, NodeDecl, EdgeDecl } from './ast.js';
import { GrxParseError } from './errors.js';
import { getComponent } from './registry.js';
import { CommunicationGraph } from '../graph/graph.js';
import { NodeInstance } from '../runtime/node-instance.js';
import { Scheduler } from '../runtime/scheduler.js';

export interface CompileResult {
  graph: CommunicationGraph;
  scheduler: Scheduler;
}

export function compile(ast: GraphDecl): CompileResult {
  const graph = new CommunicationGraph();
  graph.graph.name = ast.id;

  const nodeInstances = new Map<string, NodeInstance>();

  // First pass: collect all nodes and edges, tracking depth and parent paths
  processChildren(ast.children, null, 0, [], graph, nodeInstances);

  // Create scheduler and register all node instances
  const scheduler = new Scheduler(graph);
  for (const [, instance] of nodeInstances) {
    scheduler.registerNode(instance);
  }

  return { graph, scheduler };
}

function processChildren(
  children: GrxNode[],
  parentId: string | null,
  depth: number,
  parentPath: string[],
  graph: CommunicationGraph,
  nodeInstances: Map<string, NodeInstance>
): void {
  for (const child of children) {
    switch (child.type) {
      case 'NodeDecl':
        processNode(child, parentId, depth, parentPath, graph, nodeInstances);
        break;
      case 'EdgeDecl':
        processEdge(child, graph);
        break;
      case 'Graph':
        throw new GrxParseError('Nested <Graph> elements are not supported', child.loc.line, child.loc.column);
    }
  }
}

function processNode(
  node: NodeDecl,
  parentId: string | null,
  depth: number,
  parentPath: string[],
  graph: CommunicationGraph,
  nodeInstances: Map<string, NodeInstance>
): void {
  const { id, component: componentName, attrs, children, loc } = node;

  // Resolve component from registry
  const definition = getComponent(componentName);
  if (!definition) {
    throw new GrxParseError(
      `Unknown component '${componentName}'. Did you forget to registerComponent('${componentName}', ...)?`,
      loc.line,
      loc.column
    );
  }

  // Build the path for this node
  const nodePath = [...parentPath, id];

  if (!nodeInstances.has(id)) {
    // First occurrence: create the node with depth/path metadata
    graph.addNode(id, {
      component: componentName,
      _depth: depth,
      _parentPath: nodePath,
      ...attrs,
    });
    const instance = new NodeInstance(definition, id, attrs);
    nodeInstances.set(id, instance);
  } else {
    // Duplicate id: this is a multi-parent reference.
    // No new node is created.
  }

  // Add edge to parent (if we have one)
  if (parentId !== null) {
    graph.addEdge(parentId, id);

    // Register as external child of the parent instance
    const parentInstance = nodeInstances.get(parentId);
    if (parentInstance) {
      const alreadyChild = parentInstance._externalChildren.some(c => c.id === id);
      if (!alreadyChild) {
        parentInstance._externalChildren.push({ id, component: componentName });
      }
    }
  }

  // Recursively process this node's children at depth+1
  processChildren(children, id, depth + 1, nodePath, graph, nodeInstances);
}

function processEdge(edge: EdgeDecl, graph: CommunicationGraph): void {
  const { source, target, attrs, loc } = edge;

  // Auto-generate edge key based on attrs (use channel if present, else auto)
  const key = (attrs.channel as string) ?? undefined;
  graph.addEdge(source, target, key, attrs);
}
