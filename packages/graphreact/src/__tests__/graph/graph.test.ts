import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';

describe('CommunicationGraph', () => {
  describe('node operations', () => {
    it('adds and queries nodes', () => {
      const g = new CommunicationGraph();
      g.addNode('a', { label: 'Node A' });
      g.addNode('b');

      expect(g.hasNode('a')).toBe(true);
      expect(g.hasNode('b')).toBe(true);
      expect(g.hasNode('c')).toBe(false);
      expect(g.order()).toBe(2);
    });

    it('merges attributes on duplicate addNode', () => {
      const g = new CommunicationGraph();
      g.addNode('a', { x: 1 });
      g.addNode('a', { y: 2 });

      expect(g.getNodeData('a')).toEqual({ x: 1, y: 2 });
    });

    it('removes a node and its edges', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b');
      g.addEdge('a', 'c');
      g.removeNode('a');

      expect(g.hasNode('a')).toBe(false);
      expect(g.hasEdge('a', 'b')).toBe(false);
      expect(g.neighbors('b')).toEqual([]);
    });

    it('throws on removing nonexistent node', () => {
      const g = new CommunicationGraph();
      expect(() => g.removeNode('x')).toThrow("Node 'x' not in graph");
    });

    it('iterates nodes', () => {
      const g = new CommunicationGraph();
      g.addNode('a');
      g.addNode('b');
      g.addNode('c');
      expect([...g.nodes()]).toEqual(['a', 'b', 'c']);
    });
  });

  describe('edge operations', () => {
    it('adds edges and auto-creates nodes', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b');

      expect(g.hasNode('a')).toBe(true);
      expect(g.hasNode('b')).toBe(true);
      expect(g.hasEdge('a', 'b')).toBe(true);
      expect(g.hasEdge('b', 'a')).toBe(true); // bidirectional
    });

    it('supports multi-edges with auto keys', () => {
      const g = new CommunicationGraph();
      const k1 = g.addEdge('a', 'b', undefined, { channel: 'data' });
      const k2 = g.addEdge('a', 'b', undefined, { channel: 'control' });

      expect(k1).toBe('0');
      expect(k2).toBe('1');
      expect(g.edgeKeys('a', 'b')).toEqual(['0', '1']);
      expect(g.getEdgeData('a', 'b', '0')).toEqual({ channel: 'data' });
      expect(g.getEdgeData('a', 'b', '1')).toEqual({ channel: 'control' });
    });

    it('supports named edge keys', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'data-channel', { weight: 5 });
      g.addEdge('a', 'b', 'control-channel', { weight: 1 });

      expect(g.hasEdge('a', 'b', 'data-channel')).toBe(true);
      expect(g.hasEdge('a', 'b', 'control-channel')).toBe(true);
      expect(g.hasEdge('a', 'b', 'nonexistent')).toBe(false);
    });

    it('updates edge attrs with same key', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1 });
      g.addEdge('a', 'b', 'k', { weight: 5 });

      expect(g.getEdgeData('a', 'b', 'k')).toEqual({ weight: 5 });
    });

    it('shares edge data bidirectionally', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0', { x: 1 });

      // Both sides see the same data (shared reference)
      const fromA = g.getEdgeData('a', 'b', '0');
      const fromB = g.getEdgeData('b', 'a', '0');
      expect(fromA).toBe(fromB); // same object reference
    });

    it('removes a specific edge key', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0');
      g.addEdge('a', 'b', '1');
      g.removeEdge('a', 'b', '0');

      expect(g.hasEdge('a', 'b', '0')).toBe(false);
      expect(g.hasEdge('a', 'b', '1')).toBe(true);
      expect(g.hasEdge('a', 'b')).toBe(true); // still has edge 1
    });

    it('removes all edges between a pair', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0');
      g.addEdge('a', 'b', '1');
      g.removeEdge('a', 'b');

      expect(g.hasEdge('a', 'b')).toBe(false);
      expect(g.hasEdge('b', 'a')).toBe(false);
    });

    it('handles self-loops', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'a', '0', { type: 'self' });

      expect(g.hasEdge('a', 'a')).toBe(true);
      expect(g.neighbors('a')).toEqual(['a']);
      expect(g.getEdgeData('a', 'a', '0')).toEqual({ type: 'self' });
    });
  });

  describe('neighbors and degree', () => {
    it('returns neighbors', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b');
      g.addEdge('a', 'c');

      const nbrs = g.neighbors('a').sort();
      expect(nbrs).toEqual(['b', 'c']);
    });

    it('degree counts multi-edges', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b');
      g.addEdge('a', 'b'); // second edge
      g.addEdge('a', 'c');

      expect(g.degree('a')).toBe(3);
    });
  });

  describe('iteration and size', () => {
    it('counts edges correctly', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b');
      g.addEdge('a', 'b'); // multi-edge
      g.addEdge('b', 'c');

      expect(g.size()).toBe(3);
    });

    it('iterates edges without duplicates', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0');
      g.addEdge('b', 'c', '0');

      const edges = [...g.edges()];
      expect(edges.length).toBe(2);
    });

    it('iterates edges of a specific node', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0');
      g.addEdge('a', 'c', '0');
      g.addEdge('b', 'c', '0');

      const aEdges = [...g.edgesOf('a')];
      expect(aEdges.length).toBe(2);
      expect(aEdges.every(([u]) => u === 'a')).toBe(true);
    });
  });

  describe('edge mutation', () => {
    it('updateEdge merges attributes on existing edge', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1, label: 'original' });
      g.updateEdge('a', 'b', 'k', { weight: 5 });

      expect(g.getEdgeData('a', 'b', 'k')).toEqual({ weight: 5, label: 'original' });
    });

    it('updateEdge with no key updates first edge', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', undefined, { weight: 1 });
      g.updateEdge('a', 'b', undefined, { weight: 10 });

      expect(g.getEdgeData('a', 'b')).toEqual({ weight: 10 });
    });

    it('updateEdge throws if edge does not exist', () => {
      const g = new CommunicationGraph();
      g.addNode('a');
      g.addNode('b');
      expect(() => g.updateEdge('a', 'b', undefined, { x: 1 })).toThrow('Edge (a, b) not in graph');
    });

    it('updateEdge throws if key does not exist', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k1');
      expect(() => g.updateEdge('a', 'b', 'k2', { x: 1 })).toThrow('Edge (a, b, k2) not in graph');
    });

    it('updateEdge does NOT auto-create nodes', () => {
      const g = new CommunicationGraph();
      expect(() => g.updateEdge('x', 'y', undefined, { x: 1 })).toThrow();
      expect(g.hasNode('x')).toBe(false);
    });

    it('updateEdge is visible bidirectionally', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1 });
      g.updateEdge('a', 'b', 'k', { weight: 99 });

      expect(g.getEdgeData('b', 'a', 'k').weight).toBe(99);
    });

    it('setEdgeData replaces all attributes', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1, label: 'old', extra: true });
      g.setEdgeData('a', 'b', 'k', { weight: 5 });

      expect(g.getEdgeData('a', 'b', 'k')).toEqual({ weight: 5 });
    });

    it('setEdgeData with no key replaces first edge data', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', undefined, { old: true });
      g.setEdgeData('a', 'b', undefined, { new: true });

      expect(g.getEdgeData('a', 'b')).toEqual({ new: true });
    });

    it('setEdgeData throws if edge does not exist', () => {
      const g = new CommunicationGraph();
      g.addNode('a');
      expect(() => g.setEdgeData('a', 'b', undefined, {})).toThrow();
    });

    it('setEdgeData is visible bidirectionally', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { old: true });
      g.setEdgeData('a', 'b', 'k', { replaced: true });

      expect(g.getEdgeData('b', 'a', 'k')).toEqual({ replaced: true });
    });

    it('setNodeData replaces all node attributes', () => {
      const g = new CommunicationGraph();
      g.addNode('a', { x: 1, y: 2 });
      g.setNodeData('a', { z: 3 });

      expect(g.getNodeData('a')).toEqual({ z: 3 });
    });

    it('setNodeData throws if node does not exist', () => {
      const g = new CommunicationGraph();
      expect(() => g.setNodeData('x', {})).toThrow("Node 'x' not in graph");
    });
  });

  describe('topology change listeners', () => {
    it('fires node-added on addNode', () => {
      const g = new CommunicationGraph();
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.addNode('a');
      expect(events).toEqual([{ type: 'node-added', nodeId: 'a' }]);
    });

    it('does NOT fire node-added on addNode merge', () => {
      const g = new CommunicationGraph();
      g.addNode('a', { x: 1 });
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.addNode('a', { y: 2 }); // merge, not new
      expect(events).toEqual([]);
    });

    it('fires node-removed and edge-removed on removeNode', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k1');
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.removeNode('a');
      // edge-removed fires before node-removed
      expect(events).toEqual([
        { type: 'edge-removed', u: 'a', v: 'b', key: 'k1' },
        { type: 'node-removed', nodeId: 'a' },
      ]);
    });

    it('fires edge-added on addEdge', () => {
      const g = new CommunicationGraph();
      g.addNode('a');
      g.addNode('b');
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.addEdge('a', 'b', 'k1', { weight: 1 });
      expect(events).toEqual([{ type: 'edge-added', u: 'a', v: 'b', key: 'k1' }]);
    });

    it('fires node-added for auto-created nodes in addEdge', () => {
      const g = new CommunicationGraph();
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.addEdge('x', 'y', 'k');
      expect(events).toContainEqual({ type: 'node-added', nodeId: 'x' });
      expect(events).toContainEqual({ type: 'node-added', nodeId: 'y' });
      expect(events).toContainEqual({ type: 'edge-added', u: 'x', v: 'y', key: 'k' });
    });

    it('fires edge-updated when addEdge merges existing key', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1 });
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.addEdge('a', 'b', 'k', { weight: 5 });
      expect(events).toEqual([{ type: 'edge-updated', u: 'a', v: 'b', key: 'k' }]);
    });

    it('fires edge-removed on removeEdge with key', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k1');
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.removeEdge('a', 'b', 'k1');
      expect(events).toEqual([{ type: 'edge-removed', u: 'a', v: 'b', key: 'k1' }]);
    });

    it('fires edge-removed for each key when removeEdge removes all', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k1');
      g.addEdge('a', 'b', 'k2');
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.removeEdge('a', 'b');
      expect(events).toEqual([
        { type: 'edge-removed', u: 'a', v: 'b', key: 'k1' },
        { type: 'edge-removed', u: 'a', v: 'b', key: 'k2' },
      ]);
    });

    it('fires edge-updated on updateEdge', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { weight: 1 });
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.updateEdge('a', 'b', 'k', { weight: 5 });
      expect(events).toEqual([{ type: 'edge-updated', u: 'a', v: 'b', key: 'k' }]);
    });

    it('fires edge-updated on setEdgeData', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', 'k', { old: true });
      const events: any[] = [];
      g.onTopologyChange((e) => events.push(e));

      g.setEdgeData('a', 'b', 'k', { new: true });
      expect(events).toEqual([{ type: 'edge-updated', u: 'a', v: 'b', key: 'k' }]);
    });

    it('unsubscribe stops events', () => {
      const g = new CommunicationGraph();
      const events: any[] = [];
      const unsub = g.onTopologyChange((e) => events.push(e));

      g.addNode('a');
      expect(events.length).toBe(1);

      unsub();
      g.addNode('b');
      expect(events.length).toBe(1); // no new events
    });

    it('no events when no listeners registered', () => {
      const g = new CommunicationGraph();
      // Should not throw
      g.addNode('a');
      g.addEdge('a', 'b');
      g.removeEdge('a', 'b');
      g.removeNode('a');
    });
  });

  describe('copy', () => {
    it('creates an independent copy', () => {
      const g = new CommunicationGraph();
      g.addEdge('a', 'b', '0', { weight: 1 });

      const g2 = g.copy();
      g2.addNode('c');
      g2.getEdgeData('a', 'b', '0').weight = 99;

      expect(g.hasNode('c')).toBe(false);
      // Copy should be independent (attrs are shallow-copied)
      expect(g.getEdgeData('a', 'b', '0').weight).toBe(1);
    });
  });
});
