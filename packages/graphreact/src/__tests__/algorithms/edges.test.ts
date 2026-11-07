import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import {
  areConnected,
  listEdges,
  listEdgesBetween,
  listEdgesOf,
  connectedPairs,
} from '../../core/algorithms/edges.js';

describe('Edge algorithms', () => {
  function makeGraph(): CommunicationGraph {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b', '0', { weight: 1 });
    g.addEdge('a', 'b', '1', { weight: 2 });
    g.addEdge('b', 'c', '0', { weight: 3 });
    g.addNode('d'); // isolated
    return g;
  }

  describe('areConnected', () => {
    it('returns true for connected nodes', () => {
      const g = makeGraph();
      expect(areConnected(g, 'a', 'b')).toBe(true);
      expect(areConnected(g, 'b', 'a')).toBe(true); // bidirectional
    });

    it('returns false for unconnected nodes', () => {
      const g = makeGraph();
      expect(areConnected(g, 'a', 'c')).toBe(false);
      expect(areConnected(g, 'a', 'd')).toBe(false);
    });

    it('returns false for nonexistent nodes', () => {
      const g = makeGraph();
      expect(areConnected(g, 'a', 'z')).toBe(false);
    });
  });

  describe('listEdges', () => {
    it('lists all edges in the graph', () => {
      const g = makeGraph();
      const edges = listEdges(g);
      expect(edges.length).toBe(3); // 2 between a-b + 1 between b-c
    });

    it('includes attrs', () => {
      const g = makeGraph();
      const edges = listEdges(g);
      const abEdge0 = edges.find(e => e.key === '0' && e.source === 'a');
      expect(abEdge0?.attrs.weight).toBe(1);
    });

    it('returns empty for empty graph', () => {
      expect(listEdges(new CommunicationGraph())).toEqual([]);
    });
  });

  describe('listEdgesBetween', () => {
    it('lists all edges between two nodes (multi-edge)', () => {
      const g = makeGraph();
      const edges = listEdgesBetween(g, 'a', 'b');
      expect(edges.length).toBe(2);
      expect(edges.map(e => e.key).sort()).toEqual(['0', '1']);
    });

    it('returns empty for unconnected nodes', () => {
      const g = makeGraph();
      expect(listEdgesBetween(g, 'a', 'd')).toEqual([]);
    });

    it('works in both directions', () => {
      const g = makeGraph();
      const ab = listEdgesBetween(g, 'a', 'b');
      const ba = listEdgesBetween(g, 'b', 'a');
      expect(ab.length).toBe(ba.length);
    });
  });

  describe('listEdgesOf', () => {
    it('lists all edges of a node', () => {
      const g = makeGraph();
      const edges = listEdgesOf(g, 'b');
      expect(edges.length).toBe(3); // 2 to a + 1 to c
    });

    it('returns empty for isolated node', () => {
      const g = makeGraph();
      expect(listEdgesOf(g, 'd')).toEqual([]);
    });
  });

  describe('connectedPairs', () => {
    it('returns unique node pairs that share edges', () => {
      const g = makeGraph();
      const pairs = connectedPairs(g);
      expect(pairs.length).toBe(2); // [a,b] and [b,c]
      expect(pairs).toContainEqual(['a', 'b']);
      expect(pairs).toContainEqual(['b', 'c']);
    });

    it('returns empty for graph with no edges', () => {
      const g = new CommunicationGraph();
      g.addNode('a');
      g.addNode('b');
      expect(connectedPairs(g)).toEqual([]);
    });
  });
});
