import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';
import type { Message } from '../../core/types.js';

describe('Message passing integration', () => {
  it('sends and receives messages between two nodes', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        emit('ping', { value: 'hello' });
      }, []);
      return { accepts: [], emits: ['ping'] };
    });

    const Receiver = defineNode('Receiver', (ctx) => {
      useMessage('ping', (msg) => {
        received.push(msg.payload);
      });
      return { accepts: ['ping'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
      g.addEdge('sender', 'receiver');
    });

    scheduler.start();
    expect(received).toEqual([{ value: 'hello' }]);
  });

  it('respects permission manifest — rejects unauthorized messages', () => {
    const dropped: string[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('secret', { data: 'classified' });
      }, []);
      return { accepts: [], emits: ['secret'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('ping', () => {});
      return { accepts: ['ping'], emits: [] }; // does NOT accept 'secret'
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
      g.addEdge('sender', 'receiver');
    });

    scheduler.onMessageDropped = (msg, reason) => {
      dropped.push(reason);
    };

    scheduler.start();
    expect(dropped.length).toBe(1);
    expect(dropped[0]).toContain('rejected');
  });

  it('respects edge filter — blocks unallowed message types', () => {
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

    const Receiver = defineNode('Receiver', () => {
      useMessage('allowed', () => received.push('allowed'));
      useMessage('blocked', () => received.push('blocked'));
      return { accepts: ['allowed', 'blocked'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
      g.addEdge('sender', 'receiver', '0', { filter: ['allowed'] }); // only 'allowed' passes
    });

    scheduler.onMessageDropped = (msg, reason) => dropped.push(msg.type);

    scheduler.start();
    expect(received).toEqual(['allowed']);
    expect(dropped).toEqual(['blocked']);
  });

  it('state updates reactively across nodes', () => {
    const loggedValues: number[] = [];

    const Counter = defineNode('Counter', () => {
      const [count, setCount] = useState(0);
      const emit = useEmit();

      useMessage('increment', () => {
        setCount(prev => prev + 1);
      });

      useEffect(() => {
        emit('count-updated', { value: count });
      }, [count]);

      return { accepts: ['increment'], emits: ['count-updated'] };
    });

    const Logger = defineNode('Logger', () => {
      useMessage('count-updated', (msg) => {
        loggedValues.push((msg.payload as any).value);
      });
      return { accepts: ['count-updated'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('counter', Counter);
      g.addNode('logger', Logger);
      g.addEdge('counter', 'logger');
    });

    scheduler.start();
    // On mount, count=0, effect emits count-updated(0)
    expect(loggedValues).toEqual([0]);

    // Send increment from outside
    scheduler.send('counter', 'increment', {});
    expect(loggedValues).toEqual([0, 1]);
  });

  it('TTL prevents infinite message loops in cycles', () => {
    let pingCount = 0;
    let pongCount = 0;
    const dropped: Message[] = [];

    const PingNode = defineNode('Ping', () => {
      const emit = useEmit();
      useMessage('pong', () => {
        pongCount++;
        emit('ping', {});
      });
      useEffect(() => {
        emit('ping', {});
      }, []);
      return { accepts: ['pong'], emits: ['ping'] };
    });

    const PongNode = defineNode('Pong', () => {
      const emit = useEmit();
      useMessage('ping', () => {
        pingCount++;
        emit('pong', {});
      });
      return { accepts: ['ping'], emits: ['pong'] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('ping', PingNode);
      g.addNode('pong', PongNode);
      g.addEdge('ping', 'pong', '0', { ttl: 5 });
    });

    scheduler.onMessageDropped = (msg) => dropped.push(msg);
    scheduler.start();

    // With TTL=5, the loop should stop after a few bounces
    expect(pingCount).toBeGreaterThan(0);
    expect(pingCount).toBeLessThan(20); // bounded by TTL
    expect(dropped.length).toBeGreaterThan(0);
  });

  it('multi-parent: node receives from both parents', () => {
    const received: string[] = [];

    const Parent = defineNode('Parent', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        emit('data', { from: ctx.id });
      }, []);
      return { accepts: [], emits: ['data'] };
    });

    const Child = defineNode('Child', () => {
      useMessage('data', (msg) => {
        received.push(msg.from);
      });
      return { accepts: ['data'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('parent-a', Parent);
      g.addNode('parent-b', Parent);
      g.addNode('child', Child);
      g.addEdge('parent-a', 'child');
      g.addEdge('parent-b', 'child');
    });

    scheduler.start();
    expect(received.sort()).toEqual(['parent-a', 'parent-b']);
  });

  it('multi-edge: multiple channels between same nodes', () => {
    const received: string[] = [];

    const Sensor = defineNode('Sensor', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('data', { reading: 42 });
        emit('control', { cmd: 'calibrate' });
      }, []);
      return { accepts: [], emits: ['data', 'control'] };
    });

    const Processor = defineNode('Processor', () => {
      useMessage('data', () => received.push('data'));
      useMessage('control', () => received.push('control'));
      return { accepts: ['data', 'control'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sensor', Sensor);
      g.addNode('processor', Processor);
      // Two edges: data channel and control channel
      g.addEdge('sensor', 'processor', 'data', { filter: ['data'] });
      g.addEdge('sensor', 'processor', 'control', { filter: ['control'] });
    });

    scheduler.start();
    expect(received.sort()).toEqual(['control', 'data']);
  });

  it('external send injects messages into running graph', () => {
    const received: unknown[] = [];

    const Node = defineNode('Node', () => {
      useMessage('external-cmd', (msg) => {
        received.push(msg.payload);
      });
      return { accepts: ['external-cmd'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    scheduler.start();
    scheduler.send('n', 'external-cmd', { action: 'do-something' });
    expect(received).toEqual([{ action: 'do-something' }]);
  });

  it('stop cleans up effects', () => {
    let cleanedUp = false;

    const Node = defineNode('Node', () => {
      useEffect(() => {
        return () => { cleanedUp = true; };
      }, []);
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    scheduler.start();
    expect(cleanedUp).toBe(false);

    scheduler.stop();
    expect(cleanedUp).toBe(true);
  });
});
