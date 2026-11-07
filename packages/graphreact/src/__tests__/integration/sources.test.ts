import { describe, it, expect, vi } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useState, useEffect, useMessage, useEmit, useSource } from '../../core/runtime/hooks.js';
import { timerSource, delaySource } from '../../core/runtime/sources.js';
import type { EventSource } from '../../core/runtime/sources.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('useSource hook', () => {
  it('receives events from a timer source', async () => {
    const ticks: number[] = [];

    const Monitor = defineNode('Monitor', () => {
      useSource(() => timerSource(50), []);

      useMessage('tick', (msg) => {
        ticks.push((msg.payload as any).time);
      });

      return { accepts: ['tick'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('mon', Monitor);
    });

    await scheduler.startAsync();

    // Wait for a few ticks
    await delay(180);

    await scheduler.stopDaemon();
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  it('receives event from a delay source', async () => {
    let timedOut = false;

    const Waiter = defineNode('Waiter', () => {
      useSource(() => delaySource(50), []);

      useMessage('timeout', () => {
        timedOut = true;
      });

      return { accepts: ['timeout'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('w', Waiter);
    });

    await scheduler.startAsync();
    expect(timedOut).toBe(false);

    await delay(100);
    expect(timedOut).toBe(true);

    await scheduler.stopAsync();
  });

  it('cleans up sources on stop', async () => {
    let stopped = false;

    const customSource = (): EventSource => ({
      id: 'custom-test',
      start(push) {
        setInterval(() => push('tick', {}), 50);
      },
      stop() {
        stopped = true;
      },
    });

    const Node = defineNode('Node', () => {
      useSource(customSource, []);
      return { accepts: ['tick'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    await scheduler.startAsync();
    expect(stopped).toBe(false);

    await scheduler.stopDaemon();
    expect(stopped).toBe(true);
  });

  it('source events propagate through the graph', async () => {
    const received: unknown[] = [];

    const Source = defineNode('Source', () => {
      const emit = useEmit();
      useSource(() => timerSource(50), []);

      useMessage('tick', () => {
        emit('heartbeat', { alive: true });
      });

      return { accepts: ['tick'], emits: ['heartbeat'] };
    });

    const Sink = defineNode('Sink', () => {
      useMessage('heartbeat', (msg) => {
        received.push(msg.payload);
      });
      return { accepts: ['heartbeat'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('src', Source);
      g.addNode('sink', Sink);
      g.addEdge('src', 'sink');
    });

    await scheduler.startAsync();
    await delay(130);

    await scheduler.stopDaemon();
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect((received[0] as any).alive).toBe(true);
  });

  it('multiple sources on same node', async () => {
    const events: string[] = [];

    const Multi = defineNode('Multi', () => {
      useSource(() => timerSource(50), []);
      useSource(() => delaySource(80), []);

      useMessage('tick', () => events.push('tick'));
      useMessage('timeout', () => events.push('timeout'));

      return { accepts: ['tick', 'timeout'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('m', Multi);
    });

    await scheduler.startAsync();
    await delay(150);

    await scheduler.stopDaemon();
    expect(events).toContain('tick');
    expect(events).toContain('timeout');
  });
});

describe('Daemon mode', () => {
  it('startDaemon keeps alive, stopDaemon exits', async () => {
    const ticks: number[] = [];

    const Node = defineNode('Node', () => {
      useSource(() => timerSource(30), []);
      useMessage('tick', () => ticks.push(Date.now()));
      return { accepts: ['tick'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    // Start daemon in background
    const daemonPromise = scheduler.startDaemon();

    // Let it run
    await delay(120);
    expect(ticks.length).toBeGreaterThanOrEqual(2);

    // Stop daemon — should resolve the promise
    await scheduler.stopDaemon();
    await daemonPromise; // should resolve now

    const countAtStop = ticks.length;
    await delay(80);
    // No more ticks after stop
    expect(ticks.length).toBe(countAtStop);
  });

  it('startDaemon returns immediately if no sources', async () => {
    const Node = defineNode('Node', () => {
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    // Should return immediately since no sources registered
    await scheduler.startDaemon();
    // If we get here, it didn't hang
    await scheduler.stopAsync();
  });

  it('activeSourceCount tracks sources', async () => {
    const Node = defineNode('Node', () => {
      useSource(() => timerSource(100), []);
      return { accepts: ['tick'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('n', Node);
    });

    expect(scheduler.activeSourceCount()).toBe(0);
    await scheduler.startAsync();
    expect(scheduler.activeSourceCount()).toBe(1);

    await scheduler.stopDaemon();
    expect(scheduler.activeSourceCount()).toBe(0);
  });
});
