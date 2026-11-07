import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import { subgraphByNodes, subgraphView } from '../../core/graph/views.js';

describe('SubgraphView', () => {
  function makeGraph(): CommunicationGraph {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b', '0', { weight: 1 });
    g.addEdge('b', 'c', '0', { weight: 2 });
    g.addEdge('c', 'd', '0', { weight: 3 });
    return g;
  }

  it('filters nodes by ID set', () => {
    const g = makeGraph();
    const view = subgraphByNodes(g, new Set(['a', 'b']));

    expect(view.hasNode('a')).toBe(true);
    expect(view.hasNode('c')).toBe(false);
    expect(view.order()).toBe(2);
  });

  it('filters edges — only shows edges between included nodes', () => {
    const g = makeGraph();
    const view = subgraphByNodes(g, new Set(['a', 'b']));

    expect(view.hasEdge('a', 'b')).toBe(true);
    expect(view.hasEdge('b', 'c')).toBe(false); // c not in view
    expect(view.size()).toBe(1);
  });

  it('neighbors only returns nodes in the view', () => {
    const g = makeGraph();
    const view = subgraphByNodes(g, new Set(['a', 'b', 'c']));

    expect(view.neighbors('b').sort()).toEqual(['a', 'c']);
    expect(view.neighbors('c')).toEqual(['b']); // d excluded
  });

  it('custom edge filter', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b', 'data', { channel: 'data' });
    g.addEdge('a', 'b', 'control', { channel: 'control' });

    const view = subgraphView(
      g,
      undefined,
      (_u, _v, key) => key === 'data'
    );

    expect(view.hasEdge('a', 'b', 'data')).toBe(true);
    expect(view.hasEdge('a', 'b', 'control')).toBe(false);
    expect(view.size()).toBe(1);
  });

  it('reflects changes in source graph', () => {
    const g = makeGraph();
    const view = subgraphByNodes(g, new Set(['a', 'b', 'c', 'd', 'e']));

    expect(view.hasNode('e')).toBe(false); // e not in graph yet
    g.addNode('e');
    expect(view.hasNode('e')).toBe(true); // lazy — now visible
  });
});
