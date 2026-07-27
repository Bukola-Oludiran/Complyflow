import { toJSON, subgraphView, type CommunicationGraph } from 'graphreact';

export interface CytoscapeNode {
  data: { id: string; [key: string]: unknown };
}

export interface CytoscapeEdge {
  data: { source: string; target: string; [key: string]: unknown };
}

export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

/**
 * Export a GraphReact CommunicationGraph as Cytoscape.js-compatible elements.
 */
/**
 * Export only the topology subgraph (service/resource nodes and their edges).
 * Filters out infrastructure nodes (ingress-router, violation-collector, policies).
 */
export function topologyToCytoscapeElements(graph: CommunicationGraph): CytoscapeElements {
  const view = subgraphView(
    graph,
    (id) => id.startsWith('svc:') || id.startsWith('res:'),
  );

  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];

  for (const id of view.nodes()) {
    nodes.push({ data: { id, ...view.getNodeData(id) } });
  }
  for (const [u, v, key] of view.edges()) {
    edges.push({ data: { source: u, target: v, key, ...view.getEdgeData(u, v, key) } });
  }

  return { nodes, edges };
}

/**
 * Export a GraphReact CommunicationGraph as Cytoscape.js-compatible elements.
 */
export function graphToCytoscapeElements(graph: CommunicationGraph): CytoscapeElements {
  const json = toJSON(graph);

  return {
    nodes: json.nodes.map(n => ({
      data: { ...n },
    })),
    edges: json.edges.map(e => ({
      data: { ...e },
    })),
  };
}
