import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useTopology } from '../../core/runtime/hooks.js';
import type { TopologyEvent } from '../../core/types.js';

describe('useTopology hook', () => {
  it('receives node-added event from addNodeAtRuntime', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e));
      return { accepts: [], emits: [] };
    });

    const NewNode = defineNode('NewNode', () => ({ accepts: [], emits: [] }));

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
    });

    scheduler.start();
    events.length = 0; // clear events from start()

    scheduler.addNodeAtRuntime('dynamic', NewNode, {}, ['watcher']);

    const nodeAdded = events.filter((e) => e.type === 'node-added');
    expect(nodeAdded).toContainEqual({ type: 'node-added', nodeId: 'dynamic' });
  });

  it('receives node-removed and edge-removed from removeNodeAtRuntime', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e));
      return { accepts: [], emits: [] };
    });

    const Temp = defineNode('Temp', () => ({ accepts: [], emits: [] }));

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      g.addNode('temp', Temp);
      g.addEdge('watcher', 'temp');
    });

    scheduler.start();
    events.length = 0;

    scheduler.removeNodeAtRuntime('temp');

    const edgeRemoved = events.filter((e) => e.type === 'edge-removed');
    const nodeRemoved = events.filter((e) => e.type === 'node-removed');
    expect(edgeRemoved.length).toBeGreaterThan(0);
    expect(nodeRemoved).toContainEqual({ type: 'node-removed', nodeId: 'temp' });
  });

  it('filters by event type', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e), { types: ['edge-added'] });
      return { accepts: [], emits: [] };
    });

    const NewNode = defineNode('NewNode', () => ({ accepts: [], emits: [] }));

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
    });

    scheduler.start();
    events.length = 0;

    scheduler.addNodeAtRuntime('n', NewNode, {}, ['watcher']);

    // Should only have edge-added events, not node-added
    expect(events.every((e) => e.type === 'edge-added')).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('filters by neighbor proximity', () => {
    const watcherEvents: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => watcherEvents.push(e), { neighbors: true });
      return { accepts: [], emits: [] };
    });

    const A = defineNode('A', () => ({ accepts: [], emits: [] }));
    const B = defineNode('B', () => ({ accepts: [], emits: [] }));

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      g.addNode('a', A);
      g.addEdge('watcher', 'a');
      // b is NOT a neighbor of watcher
      g.addNode('b', B);
    });

    scheduler.start();
    watcherEvents.length = 0;

    // Add edge between a and b — watcher is neighbor of a, so should see it
    graph.addEdge('a', 'b', 'link');

    const edgeEvents = watcherEvents.filter((e) => e.type === 'edge-added');
    expect(edgeEvents).toContainEqual({ type: 'edge-added', u: 'a', v: 'b', key: 'link' });
  });

  it('neighbor filter excludes events from non-neighbors', () => {
    const watcherEvents: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => watcherEvents.push(e), { neighbors: true });
      return { accepts: [], emits: [] };
    });

    const X = defineNode('X', () => ({ accepts: [], emits: [] }));
    const Y = defineNode('Y', () => ({ accepts: [], emits: [] }));

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      // x and y are not neighbors of watcher
      g.addNode('x', X);
      g.addNode('y', Y);
    });

    scheduler.start();
    watcherEvents.length = 0;

    // Edge between x and y — neither is a neighbor of watcher
    graph.addEdge('x', 'y', 'link');

    expect(watcherEvents).toEqual([]);
  });

  it('combined type and neighbor filters', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e), {
        types: ['edge-updated'],
        neighbors: true,
      });
      return { accepts: [], emits: [] };
    });

    const A = defineNode('A', () => ({ accepts: [], emits: [] }));

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      g.addNode('a', A);
      g.addEdge('watcher', 'a', 'k', { weight: 1 });
    });

    scheduler.start();
    events.length = 0;

    // Update edge between watcher and a — should match both filters
    graph.updateEdge('watcher', 'a', 'k', { weight: 5 });

    expect(events).toEqual([{ type: 'edge-updated', u: 'watcher', v: 'a', key: 'k' }]);
  });

  it('unmounted nodes do not receive events', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e));
      return { accepts: [], emits: [] };
    });

    const Other = defineNode('Other', () => ({ accepts: [], emits: [] }));

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      g.addNode('other', Other);
    });

    scheduler.start();
    events.length = 0;

    // Remove (unmount) the watcher
    scheduler.removeNodeAtRuntime('watcher');
    events.length = 0;

    // Now add a new node — watcher is unmounted, should not receive
    graph.addNode('new-node');
    expect(events).toEqual([]);
  });

  it('receives edge-updated from updateEdge', () => {
    const events: TopologyEvent[] = [];

    const Watcher = defineNode('Watcher', () => {
      useTopology((e) => events.push(e));
      return { accepts: [], emits: [] };
    });

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('watcher', Watcher);
      g.addNode('peer', defineNode('Peer', () => ({ accepts: [], emits: [] })));
      g.addEdge('watcher', 'peer', 'k', { latency: 10 });
    });

    scheduler.start();
    events.length = 0;

    graph.updateEdge('watcher', 'peer', 'k', { latency: 5 });

    expect(events).toContainEqual({ type: 'edge-updated', u: 'watcher', v: 'peer', key: 'k' });
  });

  it('multiple nodes with useTopology each receive events independently', () => {
    const eventsA: TopologyEvent[] = [];
    const eventsB: TopologyEvent[] = [];

    const WatcherA = defineNode('WatcherA', () => {
      useTopology((e) => eventsA.push(e), { types: ['node-added'] });
      return { accepts: [], emits: [] };
    });

    const WatcherB = defineNode('WatcherB', () => {
      useTopology((e) => eventsB.push(e), { types: ['edge-added'] });
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('a', WatcherA);
      g.addNode('b', WatcherB);
    });

    scheduler.start();
    eventsA.length = 0;
    eventsB.length = 0;

    const NewNode = defineNode('New', () => ({ accepts: [], emits: [] }));
    scheduler.addNodeAtRuntime('new', NewNode, {}, ['a']);

    // A only watches node-added
    expect(eventsA.some((e) => e.type === 'node-added')).toBe(true);
    expect(eventsA.every((e) => e.type === 'node-added')).toBe(true);

    // B only watches edge-added
    expect(eventsB.some((e) => e.type === 'edge-added')).toBe(true);
    expect(eventsB.every((e) => e.type === 'edge-added')).toBe(true);
  });
});
