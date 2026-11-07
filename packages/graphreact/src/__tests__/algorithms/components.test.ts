import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import {
  connectedComponents,
  isConnected,
  numberOfConnectedComponents,
} from '../../core/algorithms/components.js';

describe('Connected components', () => {
  it('finds one component in a connected graph', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');

    const comps = [...connectedComponents(g)];
    expect(comps.length).toBe(1);
    expect(comps[0]).toEqual(new Set(['a', 'b', 'c']));
  });

  it('finds multiple components', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c'); // isolated
    g.addEdge('d', 'e');

    const comps = [...connectedComponents(g)];
    expect(comps.length).toBe(3);
  });

  it('isConnected returns true for connected graph', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    expect(isConnected(g)).toBe(true);
  });

  it('isConnected returns false for disconnected graph', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c');
    expect(isConnected(g)).toBe(false);
  });

  it('empty graph is connected', () => {
    expect(isConnected(new CommunicationGraph())).toBe(true);
  });

  it('counts components correctly', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c');
    g.addEdge('d', 'e');

    expect(numberOfConnectedComponents(g)).toBe(3);
  });
});
