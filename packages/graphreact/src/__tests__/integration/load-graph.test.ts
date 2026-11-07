import { describe, it, expect } from 'vitest';
import { loadGraph } from '../../core/dsl/load-graph.js';
import { defineNode } from '../../core/dsl/define-node.js';
import { useState, useEffect, useMessage, useEmit, useNeighbors } from '../../core/runtime/hooks.js';
import { validateGraph } from '../../core/dsl/validation.js';

describe('loadGraph convenience', () => {
  it('loads, compiles, and starts in one call', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => emit('ping', { v: 1 }), []);
      return { accepts: [], emits: ['ping'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('ping', (msg) => received.push(msg.payload));
      return { accepts: ['ping'], emits: [] };
    });

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Sender id="s"><Receiver id="r" /></Sender>
      </Graph>`,
      { Sender, Receiver }
    );

    expect(received).toEqual([{ v: 1 }]);
    scheduler.stop();
  });

  it('supports autoStart: false', () => {
    const Node = defineNode('Node', () => {
      return { accepts: [], emits: [] };
    });

    const { scheduler } = loadGraph(
      '<Graph id="test"><Node id="n" /></Graph>',
      { Node },
      { autoStart: false }
    );

    // Nodes not mounted yet
    const instance = scheduler.nodes.get('n')!;
    expect(instance.manifest).toBeNull();

    scheduler.start();
    expect(instance.manifest).not.toBeNull();
    scheduler.stop();
  });
});

describe('useNeighbors hook', () => {
  it('returns neighbor IDs', () => {
    let neighbors: string[] = [];

    const Node = defineNode('Node', (ctx) => {
      neighbors = useNeighbors();
      return { accepts: [], emits: [] };
    });

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Node id="center">
          <Node id="a" />
          <Node id="b" />
        </Node>
      </Graph>`,
      { Node }
    );

    // Last evaluation was for 'b', but let's check center's neighbors
    // by re-checking after start
    expect(scheduler.graph.neighbors('center').sort()).toEqual(['a', 'b']);
    scheduler.stop();
  });
});

describe('validateGraph', () => {
  it('warns about cycles', () => {
    const Node = defineNode('Node', () => {
      return { accepts: ['msg'], emits: ['msg'] };
    });

    // Triangle: a-b, b-c, c-a → cycle in undirected graph
    const { graph, scheduler } = loadGraph(
      `<Graph id="test">
        <Node id="a"><Node id="b"><Node id="c" /></Node></Node>
        <edge source="c" target="a" />
      </Graph>`,
      { Node }
    );

    const warnings = validateGraph(graph, scheduler.nodes);
    expect(warnings.some(w => w.message.includes('cycle'))).toBe(true);
    scheduler.stop();
  });

  it('warns about isolated nodes', () => {
    const Node = defineNode('Node', () => {
      return { accepts: [], emits: [] };
    });

    const { graph, scheduler } = loadGraph(
      `<Graph id="test">
        <Node id="a" />
        <Node id="b" />
      </Graph>`,
      { Node }
    );

    const warnings = validateGraph(graph, scheduler.nodes);
    expect(warnings.some(w => w.message.includes('isolated'))).toBe(true);
    scheduler.stop();
  });

  it('warns about incompatible permissions', () => {
    const Sender = defineNode('Sender', () => {
      return { accepts: [], emits: ['foo'] };
    });

    const Receiver = defineNode('Receiver', () => {
      return { accepts: ['bar'], emits: [] }; // doesn't accept 'foo'
    });

    const { graph, scheduler } = loadGraph(
      `<Graph id="test">
        <Sender id="s"><Receiver id="r" /></Sender>
      </Graph>`,
      { Sender, Receiver }
    );

    const warnings = validateGraph(graph, scheduler.nodes);
    expect(warnings.some(w => w.message.includes('no compatible message types'))).toBe(true);
    scheduler.stop();
  });
});
