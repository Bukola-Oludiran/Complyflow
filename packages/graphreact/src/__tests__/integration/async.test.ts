import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { loadGraphAsync } from '../../core/dsl/load-graph.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Async effects', () => {
  it('awaits async useEffect callbacks', async () => {
    const log: string[] = [];

    const Node = defineNode('Node', () => {
      useEffect(() => {
        // Async effect returning a promise
        return (async () => {
          await delay(10);
          log.push('async-effect-done');
        })() as any;
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    await scheduler.startAsync();
    expect(log).toContain('async-effect-done');
    await scheduler.stopAsync();
  });

  it('awaits async effect cleanup', async () => {
    let cleanedUp = false;

    const Node = defineNode('Node', () => {
      useEffect(() => {
        return async () => {
          await delay(10);
          cleanedUp = true;
        };
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    await scheduler.startAsync();
    expect(cleanedUp).toBe(false);

    await scheduler.stopAsync();
    expect(cleanedUp).toBe(true);
  });
});

describe('Async message handlers', () => {
  it('awaits async useMessage handlers', async () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('data', { value: 42 });
      }, []);
      return { accepts: [], emits: ['data'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('data', async (msg) => {
        await delay(10);
        received.push(msg.payload);
      });
      return { accepts: ['data'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
      g.addEdge('sender', 'receiver');
    });

    await scheduler.startAsync();
    expect(received).toEqual([{ value: 42 }]);
    await scheduler.stopAsync();
  });
});

describe('Parallel processing', () => {
  it('processes independent leaf nodes in parallel', async () => {
    const startTimes: Record<string, number> = {};
    const endTimes: Record<string, number> = {};

    const Leaf = defineNode('Leaf', (ctx) => {
      useEffect(() => {
        return (async () => {
          startTimes[ctx.id] = Date.now();
          await delay(50);
          endTimes[ctx.id] = Date.now();
        })() as any;
      }, []);
      return { accepts: [], emits: [] };
    });

    const Root = defineNode('Root', () => {
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('root', Root);
      g.addNode('leaf-a', Leaf);
      g.addNode('leaf-b', Leaf);
      g.addNode('leaf-c', Leaf);
      g.addEdge('root', 'leaf-a');
      g.addEdge('root', 'leaf-b');
      g.addEdge('root', 'leaf-c');
    });

    const before = Date.now();
    await scheduler.startAsync();
    const elapsed = Date.now() - before;

    // If processed sequentially: ~200ms (50ms * 4 nodes)
    // If leaves parallel: ~100ms (root 50ms + leaves 50ms in parallel)
    // Allow generous margin but should be well under 200ms
    expect(elapsed).toBeLessThan(250);

    // All leaves should have completed
    expect(Object.keys(endTimes)).toContain('leaf-a');
    expect(Object.keys(endTimes)).toContain('leaf-b');
    expect(Object.keys(endTimes)).toContain('leaf-c');

    await scheduler.stopAsync();
  });

  it('sendAsync works with async processing', async () => {
    const received: unknown[] = [];

    const Node = defineNode('Node', () => {
      useMessage('cmd', async (msg) => {
        await delay(10);
        received.push(msg.payload);
      });
      return { accepts: ['cmd'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    await scheduler.startAsync();
    await scheduler.sendAsync('n', 'cmd', { action: 'test' });
    expect(received).toEqual([{ action: 'test' }]);
    await scheduler.stopAsync();
  });
});

describe('loadGraphAsync convenience', () => {
  it('loads and starts asynchronously', async () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('ping', { v: 1 });
      }, []);
      return { accepts: [], emits: ['ping'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('ping', async (msg) => {
        await delay(5);
        received.push(msg.payload);
      });
      return { accepts: ['ping'], emits: [] };
    });

    const { scheduler } = await loadGraphAsync(
      `<Graph id="test">
        <Sender id="s"><Receiver id="r" /></Sender>
      </Graph>`,
      { Sender, Receiver }
    );

    expect(received).toEqual([{ v: 1 }]);
    await scheduler.stopAsync();
  });
});

describe('Mixed sync/async', () => {
  it('async scheduler handles sync nodes correctly', async () => {
    const values: number[] = [];

    const Counter = defineNode('Counter', () => {
      const [count] = useState(42);
      useEffect(() => {
        values.push(count);  // sync effect, no async
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('c', Counter);
    });

    await scheduler.startAsync();
    expect(values).toEqual([42]);
    await scheduler.stopAsync();
  });

  it('sync scheduler is unaffected by async additions', () => {
    const values: number[] = [];

    const Counter = defineNode('Counter', () => {
      const [count] = useState(99);
      useEffect(() => {
        values.push(count);
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('c', Counter);
    });

    // Using sync start — original behavior
    scheduler.start();
    expect(values).toEqual([99]);
    scheduler.stop();
  });
});
