import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import { toJSON, fromJSON, toGraphML } from '../../core/graph/serialization.js';

describe('JSON serialization', () => {
  it('round-trips a graph through JSON', () => {
    const g = new CommunicationGraph();
    g.graph.name = 'test';
    g.addNode('a', { label: 'A' });
    g.addNode('b', { label: 'B' });
    g.addEdge('a', 'b', '0', { weight: 5 });
    g.addEdge('a', 'b', '1', { weight: 10 });

    const json = toJSON(g);
    expect(json.multigraph).toBe(true);
    expect(json.directed).toBe(false);
    expect(json.nodes.length).toBe(2);
    expect(json.edges.length).toBe(2);

    const g2 = fromJSON(json);
    expect(g2.order()).toBe(2);
    expect(g2.size()).toBe(2);
    expect(g2.getNodeData('a').label).toBe('A');
    expect(g2.getEdgeData('a', 'b', '0').weight).toBe(5);
    expect(g2.graph.name).toBe('test');
  });

  it('handles empty graph', () => {
    const g = new CommunicationGraph();
    const json = toJSON(g);
    const g2 = fromJSON(json);
    expect(g2.order()).toBe(0);
    expect(g2.size()).toBe(0);
  });
});

describe('GraphML export', () => {
  it('produces valid GraphML XML', () => {
    const g = new CommunicationGraph();
    g.graph.name = 'test';
    g.addNode('a', { label: 'Node A' });
    g.addNode('b');
    g.addEdge('a', 'b', '0', { weight: 3 });

    const xml = toGraphML(g);
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<graphml');
    expect(xml).toContain('<node id="a">');
    expect(xml).toContain('<node id="b" />');
    expect(xml).toContain('source="a"');
    expect(xml).toContain('target="b"');
    expect(xml).toContain('<data key="weight">3</data>');
  });

  it('escapes special XML characters', () => {
    const g = new CommunicationGraph();
    g.addNode('a&b', { label: '<special>' });

    const xml = toGraphML(g);
    expect(xml).toContain('a&amp;b');
    expect(xml).toContain('&lt;special&gt;');
  });
});
