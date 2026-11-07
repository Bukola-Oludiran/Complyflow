/**
 * Graph serialization — JSON and GraphML import/export.
 * Ported from NetworkX (networkx/readwrite/json_graph/node_link.py, graphml.py).
 */

import { CommunicationGraph } from './graph.js';
import type { NodeAttributes, EdgeAttributes } from '../types.js';

// --- JSON format (node-link) ---

export interface JsonGraph {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: Array<{ id: string; [key: string]: unknown }>;
  edges: Array<{ source: string; target: string; key: string; [key: string]: unknown }>;
}

export function toJSON(graph: CommunicationGraph): JsonGraph {
  const nodes: JsonGraph['nodes'] = [];
  for (const id of graph.nodes()) {
    nodes.push({ id, ...graph.getNodeData(id) });
  }

  const edges: JsonGraph['edges'] = [];
  for (const [u, v, key] of graph.edges()) {
    edges.push({ source: u, target: v, key, ...graph.getEdgeData(u, v, key) });
  }

  return {
    directed: false,
    multigraph: true,
    graph: { ...graph.graph },
    nodes,
    edges,
  };
}

export function fromJSON(data: JsonGraph): CommunicationGraph {
  const graph = new CommunicationGraph();
  graph.graph = { ...data.graph };

  for (const node of data.nodes) {
    const { id, ...attrs } = node;
    graph.addNode(id, attrs);
  }

  for (const edge of data.edges) {
    const { source, target, key, ...attrs } = edge;
    graph.addEdge(source, target, key, attrs);
  }

  return graph;
}

// --- GraphML format ---

export function toGraphML(graph: CommunicationGraph): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphstruct.org/xmlns">',
    `  <graph id="${graph.graph.name ?? 'G'}" edgedefault="undirected">`,
  ];

  for (const id of graph.nodes()) {
    const attrs = graph.getNodeData(id);
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `      <data key="${k}">${escapeXml(String(v))}</data>`)
      .join('\n');
    if (attrStr) {
      lines.push(`    <node id="${escapeXml(id)}">`);
      lines.push(attrStr);
      lines.push('    </node>');
    } else {
      lines.push(`    <node id="${escapeXml(id)}" />`);
    }
  }

  for (const [u, v, key] of graph.edges()) {
    const attrs = graph.getEdgeData(u, v, key);
    const attrStr = Object.entries(attrs)
      .map(([k, val]) => `      <data key="${k}">${escapeXml(String(val))}</data>`)
      .join('\n');
    if (attrStr) {
      lines.push(`    <edge source="${escapeXml(u)}" target="${escapeXml(v)}" id="${escapeXml(key)}">`);
      lines.push(attrStr);
      lines.push('    </edge>');
    } else {
      lines.push(`    <edge source="${escapeXml(u)}" target="${escapeXml(v)}" id="${escapeXml(key)}" />`);
    }
  }

  lines.push('  </graph>');
  lines.push('</graphml>');
  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
