import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import { findCycle, hasCycle } from '../../core/algorithms/cycles.js';

describe('Cycle detection', () => {
  it('detects no cycle in a tree', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('b', 'd');

    expect(findCycle(g)).toBeNull();
    expect(hasCycle(g)).toBe(false);
  });

  it('detects a triangle cycle', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'a');

    expect(hasCycle(g)).toBe(true);
    const cycle = findCycle(g)!;
    expect(cycle.length).toBeGreaterThanOrEqual(2);
  });

  it('detects cycle in a larger graph', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'd');
    g.addEdge('d', 'b'); // cycle: b-c-d-b

    expect(hasCycle(g)).toBe(true);
  });

  it('handles disconnected graph with cycle in one component', () => {
    const g = new CommunicationGraph();
    // Component 1: no cycle
    g.addEdge('a', 'b');
    // Component 2: cycle
    g.addEdge('x', 'y');
    g.addEdge('y', 'z');
    g.addEdge('z', 'x');

    expect(hasCycle(g)).toBe(true);
  });

  it('no cycle in empty graph', () => {
    const g = new CommunicationGraph();
    expect(hasCycle(g)).toBe(false);
  });

  it('no cycle with single node', () => {
    const g = new CommunicationGraph();
    g.addNode('a');
    expect(hasCycle(g)).toBe(false);
  });
});
