import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';
import type { IncomingMessage } from '../../core/types.js';

describe('Channel policies', () => {
  it('per-neighbor accepts — same type accepted from A but rejected from B', () => {
    const received: string[] = [];
    const dropped: string[] = [];

    const NodeA = defineNode('NodeA', () => {
      const emit = useEmit();
      useEffect(() => emit('data', { from: 'A' }), []);
      return { accepts: [], emits: ['data'] };
    });

    const NodeB = defineNode('NodeB', () => {
      const emit = useEmit();
      useEffect(() => emit('data', { from: 'B' }), []);
      return { accepts: [], emits: ['data'] };
    });

    const Target = defineNode('Target', () => {
      useMessage('data', (msg) => received.push(msg.from));
      return {
        accepts: ['data'],
        emits: [],
        channels: {
          'a': { accepts: ['data'] },      // accept from A
          'b': { accepts: [] },             // reject from B
        },
      };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('a', NodeA);
      g.addNode('b', NodeB);
      g.addNode('target', Target);
      g.addEdge('a', 'target');
      g.addEdge('b', 'target');
    });

    scheduler.onMessageDropped = (msg) => dropped.push(msg.from);
    scheduler.start();

    expect(received).toEqual(['a']);
    expect(dropped).toContain('b');
  });

  it('wildcard * default channel', () => {
    const received: string[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => emit('ping', {}), []);
      return { accepts: [], emits: ['ping'] };
    });

    const Target = defineNode('Target', () => {
      useMessage('ping', (msg) => received.push(msg.from));
      return {
        accepts: [],   // global fallback rejects all
        emits: [],
        channels: {
          '*': { accepts: ['ping'] },  // but wildcard allows ping from anyone
        },
      };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('s1', Sender);
      g.addNode('s2', Sender);
      g.addNode('target', Target);
      g.addEdge('s1', 'target');
      g.addEdge('s2', 'target');
    });

    scheduler.start();
    expect(received.sort()).toEqual(['s1', 's2']);
  });

  it('node channel policy overrides global accepts', () => {
    const received: string[] = [];
    const dropped: string[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('allowed', {});
        emit('blocked', {});
      }, []);
      return { accepts: [], emits: ['allowed', 'blocked'] };
    });

    const Target = defineNode('Target', () => {
      useMessage('allowed', () => received.push('allowed'));
      useMessage('blocked', () => received.push('blocked'));
      return {
        accepts: ['allowed', 'blocked'],  // global says both OK
        emits: [],
        channels: {
          'sender': { accepts: ['allowed'] },  // but channel only allows 'allowed'
        },
      };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('target', Target);
      g.addEdge('sender', 'target');
    });

    scheduler.onMessageDropped = (msg) => dropped.push(msg.type);
    scheduler.start();

    expect(received).toEqual(['allowed']);
    expect(dropped).toContain('blocked');
  });

  it('backward compatibility — old { accepts, emits } still works', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => emit('data', { v: 1 }), []);
      return { accepts: [], emits: ['data'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('data', (msg) => received.push(msg.payload));
      return { accepts: ['data'], emits: [] }; // no channels — legacy format
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('s', Sender);
      g.addNode('r', Receiver);
      g.addEdge('s', 'r');
    });

    scheduler.start();
    expect(received).toEqual([{ v: 1 }]);
  });
});

describe('Edge transforms', () => {
  it('multiply-weight transform modifies payload in transit', () => {
    const received: number[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => emit('signal', { value: 10 }), []);
      return { accepts: [], emits: ['signal'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('signal', (msg) => {
        received.push((msg.payload as any).value);
      });
      return { accepts: ['signal'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('s', Sender);
      g.addNode('r', Receiver);
      g.addEdge('s', 'r', '0', { weight: 0.5, transform: 'multiply-weight' });
    });

    scheduler.start();
    expect(received).toEqual([5]); // 10 * 0.5
  });

  it('threshold-gate drops messages below threshold', () => {
    const received: number[] = [];
    const dropped: string[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('signal', { value: 3 });
        emit('signal', { value: 8 });
      }, []);
      return { accepts: [], emits: ['signal'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('signal', (msg) => {
        received.push((msg.payload as any).value);
      });
      return { accepts: ['signal'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('s', Sender);
      g.addNode('r', Receiver);
      g.addEdge('s', 'r', '0', { weight: 5, transform: 'threshold-gate' }); // threshold = 5
    });

    scheduler.onMessageDropped = (msg) => dropped.push(msg.type);
    scheduler.start();

    expect(received).toEqual([8]); // only value >= 5 passes
    expect(dropped.length).toBe(1);
  });

  it('node-level transform function takes precedence over edge transform', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => emit('data', { value: 10 }), []);
      return { accepts: [], emits: ['data'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('data', (msg) => received.push(msg.payload));
      return {
        accepts: ['data'],
        emits: [],
        channels: {
          's': {
            accepts: ['data'],
            // Node-level transform: triple the value
            transform: (msg: IncomingMessage) => ({
              ...msg,
              payload: { value: (msg.payload as any).value * 3 },
            }),
          },
        },
      };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('s', Sender);
      g.addNode('r', Receiver);
      // Edge says multiply-weight (0.5), but node-level transform should win
      g.addEdge('s', 'r', '0', { weight: 0.5, transform: 'multiply-weight' });
    });

    scheduler.start();
    expect(received).toEqual([{ value: 30 }]); // node transform: 10 * 3
  });

  it('Hopfield-style: edge weights transform signals automatically', () => {
    const received: Map<string, number> = new Map();

    const Neuron = defineNode('Neuron', (ctx) => {
      const emit = useEmit();

      useMessage('signal', (msg) => {
        const prev = received.get(ctx.id) ?? 0;
        received.set(ctx.id, prev + (msg.payload as any).value);
      });

      useEffect(() => {
        emit('signal', { value: 1.0 });
      }, []);

      return { accepts: ['signal'], emits: ['signal'] };
    });

    const { scheduler: s2 } = createGraph('hopfield', (g) => {
      g.addNode('a', Neuron);
      g.addNode('b', Neuron);
      g.addEdge('a', 'b', '0', { weight: 0.8, transform: 'multiply-weight' });
    });

    received.clear();
    s2.start();

    // a fires signal(1.0), edge transforms to signal(0.8), b receives 0.8
    // b also fires signal(1.0), edge transforms to signal(0.8), a receives 0.8
    expect(received.get('a')).toBeCloseTo(0.8);
    expect(received.get('b')).toBeCloseTo(0.8);
  });
});
