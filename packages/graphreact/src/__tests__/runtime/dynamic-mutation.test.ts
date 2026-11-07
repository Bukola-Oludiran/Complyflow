import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';

describe('Dynamic runtime graph mutation', () => {
  it('addNodeAtRuntime adds a node to a running graph', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();

      useMessage('trigger', () => {
        emit('ping', { v: 2 });
      });

      return { accepts: ['trigger'], emits: ['ping'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('ping', (msg) => received.push(msg.payload));
      return { accepts: ['ping'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
    });

    scheduler.start();

    // Dynamically add receiver and connect
    scheduler.addNodeAtRuntime('receiver', Receiver, {}, ['sender']);

    // Trigger sender to emit — receiver should get it
    scheduler.send('sender', 'trigger', {});
    expect(received).toEqual([{ v: 2 }]);
  });

  it('addNodeAtRuntime evaluates the node immediately', () => {
    let mounted = false;

    const Node = defineNode('Node', () => {
      useEffect(() => { mounted = true; }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {});
    scheduler.start();

    expect(mounted).toBe(false);
    scheduler.addNodeAtRuntime('n', Node);
    expect(mounted).toBe(true);
  });

  it('addNodeAtRuntime connects to multiple existing nodes', () => {
    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('a', defineNode('A', () => ({ accepts: [], emits: [] })));
      g.addNode('b', defineNode('B', () => ({ accepts: [], emits: [] })));
    });

    scheduler.start();

    const NewNode = defineNode('New', () => ({ accepts: [], emits: [] }));
    scheduler.addNodeAtRuntime('new', NewNode, {}, ['a', 'b']);

    expect(graph.hasEdge('new', 'a')).toBe(true);
    expect(graph.hasEdge('new', 'b')).toBe(true);
    expect(graph.neighbors('new').sort()).toEqual(['a', 'b']);
  });

  it('removeNodeAtRuntime removes node and cleans up', () => {
    let cleanedUp = false;

    const Node = defineNode('Node', () => {
      useEffect(() => {
        return () => { cleanedUp = true; };
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('a', defineNode('A', () => ({ accepts: [], emits: [] })));
      g.addNode('n', Node);
      g.addEdge('a', 'n');
    });

    scheduler.start();
    expect(graph.hasNode('n')).toBe(true);
    expect(cleanedUp).toBe(false);

    scheduler.removeNodeAtRuntime('n');
    expect(graph.hasNode('n')).toBe(false);
    expect(cleanedUp).toBe(true);
    expect(scheduler.nodes.has('n')).toBe(false);
  });

  it('dynamically added node can send and receive messages', () => {
    const log: string[] = [];

    const Existing = defineNode('Existing', () => {
      useMessage('hello', (msg) => {
        log.push(`existing got: ${(msg.payload as any).from}`);
      });
      return { accepts: ['hello'], emits: [] };
    });

    const Dynamic = defineNode('Dynamic', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('hello', { from: 'dynamic' });
      }, []);
      return { accepts: [], emits: ['hello'] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('existing', Existing);
    });

    scheduler.start();

    scheduler.addNodeAtRuntime('dynamic', Dynamic, {}, ['existing']);
    expect(log).toEqual(['existing got: dynamic']);
  });

  it('removeNodeAtRuntime on nonexistent node does not throw', () => {
    const { scheduler } = createGraph('test', (g) => {});
    scheduler.start();

    // Should not throw
    expect(() => scheduler.removeNodeAtRuntime('nonexistent')).not.toThrow();
  });
});
