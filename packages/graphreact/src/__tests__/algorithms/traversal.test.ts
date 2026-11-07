import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import { bfsEdges, bfsNodes, dfsEdges, dfsNodes } from '../../core/algorithms/traversal.js';

function makeLinearGraph(): CommunicationGraph {
  // a - b - c - d
  const g = new CommunicationGraph();
  g.addEdge('a', 'b');
  g.addEdge('b', 'c');
  g.addEdge('c', 'd');
  return g;
}

function makeStarGraph(): CommunicationGraph {
  // center connected to a, b, c, d
  const g = new CommunicationGraph();
  g.addEdge('center', 'a');
  g.addEdge('center', 'b');
  g.addEdge('center', 'c');
  g.addEdge('center', 'd');
  return g;
}

describe('BFS', () => {
  it('bfsEdges traverses in breadth-first order', () => {
    const g = makeLinearGraph();
    const edges = [...bfsEdges(g, 'a')];
    expect(edges).toEqual([['a', 'b'], ['b', 'c'], ['c', 'd']]);
  });

  it('bfsNodes yields nodes in BFS order', () => {
    const g = makeLinearGraph();
    expect([...bfsNodes(g, 'a')]).toEqual(['a', 'b', 'c', 'd']);
  });

  it('bfsEdges from star center visits all spokes at depth 1', () => {
    const g = makeStarGraph();
    const edges = [...bfsEdges(g, 'center')];
    expect(edges.length).toBe(4);
    expect(edges.every(([parent]) => parent === 'center')).toBe(true);
  });

  it('respects depth limit', () => {
    const g = makeLinearGraph();
    const nodes = [...bfsNodes(g, 'a', 2)];
    expect(nodes).toEqual(['a', 'b', 'c']); // depth 0, 1, 2 — but limit=2 means max 2 hops
  });

  it('throws for nonexistent source', () => {
    const g = new CommunicationGraph();
    expect(() => [...bfsEdges(g, 'x')]).toThrow();
  });
});

describe('DFS', () => {
  it('dfsEdges traverses in depth-first order', () => {
    const g = makeLinearGraph();
    const edges = [...dfsEdges(g, 'a')];
    expect(edges).toEqual([['a', 'b'], ['b', 'c'], ['c', 'd']]);
  });

  it('dfsNodes yields nodes in DFS order', () => {
    const g = makeLinearGraph();
    expect([...dfsNodes(g, 'a')]).toEqual(['a', 'b', 'c', 'd']);
  });

  it('respects depth limit', () => {
    const g = makeLinearGraph();
    const nodes = [...dfsNodes(g, 'a', 2)];
    expect(nodes).toEqual(['a', 'b', 'c']);
  });

  it('handles disconnected components (only traverses reachable)', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c'); // isolated

    const nodes = [...dfsNodes(g, 'a')];
    expect(nodes).toEqual(['a', 'b']);
    expect(nodes).not.toContain('c');
  });
});
