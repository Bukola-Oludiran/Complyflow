import { describe, it, expect, beforeEach } from 'vitest';
import { Parser } from '../../core/parser/parser.js';
import { compile } from '../../core/parser/compiler.js';
import { registerComponent, clearRegistry } from '../../core/parser/registry.js';
import { defineNode } from '../../core/dsl/define-node.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';

// Test components
const Counter = defineNode('Counter', (ctx) => {
  const [count] = useState(ctx.props.initialCount ?? 0);
  return { accepts: ['increment'], emits: ['count-updated'] };
});

const Aggregator = defineNode('Aggregator', (ctx) => {
  return { accepts: ['count-updated'], emits: ['total'] };
});

const Logger = defineNode('Logger', (ctx) => {
  return { accepts: ['count-updated', 'total'], emits: [] };
});

describe('Compiler', () => {
  beforeEach(() => {
    clearRegistry();
    registerComponent('Counter', Counter);
    registerComponent('Aggregator', Aggregator);
    registerComponent('Logger', Logger);
  });

  it('compiles a simple graph with nesting', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <Aggregator id="agg">
          <Counter id="c1" initialCount={0} />
          <Counter id="c2" initialCount={10} />
        </Aggregator>
      </Graph>
    `);

    const { graph, scheduler } = compile(ast);

    expect(graph.hasNode('agg')).toBe(true);
    expect(graph.hasNode('c1')).toBe(true);
    expect(graph.hasNode('c2')).toBe(true);
    expect(graph.hasEdge('agg', 'c1')).toBe(true);
    expect(graph.hasEdge('agg', 'c2')).toBe(true);
    expect(graph.order()).toBe(3);

    expect(scheduler.nodes.size).toBe(3);
  });

  it('handles multi-parent via duplicate ID', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <Aggregator id="agg">
          <Counter id="c1" />
        </Aggregator>
        <Logger id="log">
          <Counter id="c1" />
        </Logger>
      </Graph>
    `);

    const { graph } = compile(ast);

    // c1 exists once as a node
    expect(graph.order()).toBe(3); // agg, c1, log

    // c1 has edges to both parents
    expect(graph.hasEdge('agg', 'c1')).toBe(true);
    expect(graph.hasEdge('log', 'c1')).toBe(true);

    // c1's neighbors include both parents
    expect(graph.neighbors('c1').sort()).toEqual(['agg', 'log']);
  });

  it('compiles explicit edge declarations', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <Counter id="a" />
        <Counter id="b" />
        <edge source="a" target="b" />
      </Graph>
    `);

    const { graph } = compile(ast);

    expect(graph.hasEdge('a', 'b')).toBe(true);
  });

  it('compiles multi-edge with channel attribute', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <Counter id="a" />
        <Counter id="b" />
        <edge source="a" target="b" channel="data" />
        <edge source="a" target="b" channel="control" ttl={3} />
      </Graph>
    `);

    const { graph } = compile(ast);

    expect(graph.hasEdge('a', 'b', 'data')).toBe(true);
    expect(graph.hasEdge('a', 'b', 'control')).toBe(true);
    expect(graph.getEdgeData('a', 'b', 'control').ttl).toBe(3);
  });

  it('throws on unknown component', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <UnknownWidget id="w" />
      </Graph>
    `);

    expect(() => compile(ast)).toThrow("Unknown component 'UnknownWidget'");
  });

  it('compiles the full design doc example', () => {
    const ast = Parser.parse(`
      <Graph id="my-network">
        <Aggregator id="agg">
          <Counter id="counter-a" initialCount={0} />
          <Counter id="counter-b" initialCount={10} />
        </Aggregator>

        <Logger id="logger" level="debug">
          <Counter id="counter-a" />
          <Counter id="counter-b" />
        </Logger>

        <edge source="counter-a" target="counter-b" />
        <edge source="counter-a" target="counter-b" channel="control" ttl={3} />
      </Graph>
    `);

    const { graph, scheduler } = compile(ast);

    // 4 unique nodes
    expect(graph.order()).toBe(4);

    // counter-a connected to: agg, logger, counter-b
    const counterANeighbors = graph.neighbors('counter-a').sort();
    expect(counterANeighbors).toEqual(['agg', 'counter-b', 'logger']);

    // Multi-edge: counter-a <-> counter-b has at least 2 edges
    expect(graph.edgeKeys('counter-a', 'counter-b').length).toBeGreaterThanOrEqual(2);

    // All 4 node instances registered
    expect(scheduler.nodes.size).toBe(4);
  });

  it('end-to-end: parse .grx, compile, run, and send messages', () => {
    const received: unknown[] = [];

    // Re-register with actual logic
    clearRegistry();

    const SenderNode = defineNode('Sender', () => {
      const emit = useEmit();
      useEffect(() => {
        emit('data', { value: 42 });
      }, []);
      return { accepts: [], emits: ['data'] };
    });

    const ReceiverNode = defineNode('Receiver', () => {
      useMessage('data', (msg) => {
        received.push(msg.payload);
      });
      return { accepts: ['data'], emits: [] };
    });

    registerComponent('Sender', SenderNode);
    registerComponent('Receiver', ReceiverNode);

    const ast = Parser.parse(`
      <Graph id="e2e">
        <Sender id="s">
          <Receiver id="r" />
        </Sender>
      </Graph>
    `);

    const { scheduler } = compile(ast);
    scheduler.start();

    expect(received).toEqual([{ value: 42 }]);
  });
});
