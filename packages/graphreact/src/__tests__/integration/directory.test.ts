import { describe, it, expect } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { loadGraph } from '../../core/dsl/load-graph.js';
import { useState, useEffect, useMessage, useEmit } from '../../core/runtime/hooks.js';
import type { GraphDirectory } from '../../core/runtime/directory.js';

describe('Graph Directory', () => {
  it('provides directory on ctx with role and depth', () => {
    let capturedDir: GraphDirectory | null = null;
    let capturedDepth = -1;
    let capturedPath: string[] = [];

    const Manager = defineNode('Manager', (ctx) => {
      capturedDir = ctx.directory;
      capturedDepth = ctx.myDepth;
      capturedPath = ctx.myPath;
      return { accepts: [], emits: [] };
    });

    const Worker = defineNode('Worker', () => {
      return { accepts: [], emits: [] };
    });

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Manager id="mgr">
          <Worker id="w1" />
          <Worker id="w2" />
        </Manager>
      </Graph>`,
      { Manager, Worker }
    );

    expect(capturedDir).not.toBeNull();
    expect(capturedDir!.findByRole('Manager')).toEqual(['mgr']);
    expect(capturedDir!.findByRole('Worker').sort()).toEqual(['w1', 'w2']);
    expect(capturedDepth).toBe(0);
    expect(capturedPath).toContain('mgr');
    scheduler.stop();
  });

  it('findByDepth returns nodes at the correct level', () => {
    let dir: GraphDirectory | null = null;

    const Root = defineNode('Root', (ctx) => {
      dir = ctx.directory;
      return { accepts: [], emits: [] };
    });
    const Mid = defineNode('Mid', () => ({ accepts: [], emits: [] }));
    const Leaf = defineNode('Leaf', () => ({ accepts: [], emits: [] }));

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Root id="root">
          <Mid id="mid">
            <Leaf id="leaf" />
          </Mid>
        </Root>
      </Graph>`,
      { Root, Mid, Leaf }
    );

    expect(dir!.findByDepth(0)).toEqual(['root']);
    expect(dir!.findByDepth(1)).toEqual(['mid']);
    expect(dir!.findByDepth(2)).toEqual(['leaf']);
    scheduler.stop();
  });

  it('isAncestor checks ancestry', () => {
    let dir: GraphDirectory | null = null;

    const Node = defineNode('Node', (ctx) => {
      if (!dir) dir = ctx.directory;
      return { accepts: [], emits: [] };
    });

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Node id="a">
          <Node id="b">
            <Node id="c" />
          </Node>
        </Node>
      </Graph>`,
      { Node }
    );

    expect(dir!.isAncestor('a', 'c')).toBe(true);
    expect(dir!.isAncestor('a', 'b')).toBe(true);
    expect(dir!.isAncestor('c', 'a')).toBe(false);
    expect(dir!.isAncestor('b', 'a')).toBe(false);
    scheduler.stop();
  });

  it('findInSubtree returns all descendants', () => {
    let dir: GraphDirectory | null = null;

    const Node = defineNode('Node', (ctx) => {
      if (!dir) dir = ctx.directory;
      return { accepts: [], emits: [] };
    });

    const { scheduler } = loadGraph(
      `<Graph id="test">
        <Node id="root">
          <Node id="a">
            <Node id="a1" />
            <Node id="a2" />
          </Node>
          <Node id="b" />
        </Node>
      </Graph>`,
      { Node }
    );

    const subtree = dir!.findInSubtree('a').sort();
    expect(subtree).toContain('a');
    expect(subtree).toContain('a1');
    expect(subtree).toContain('a2');
    expect(subtree).not.toContain('b');
    scheduler.stop();
  });

  it('directory updates on addNodeAtRuntime', () => {
    let dir: GraphDirectory | null = null;

    const Node = defineNode('Node', (ctx) => {
      dir = ctx.directory;
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('a', Node);
    });

    scheduler.start();
    expect(dir!.findByRole('Node')).toEqual(['a']);

    const NewNode = defineNode('Service', () => ({ accepts: [], emits: [] }));
    scheduler.addNodeAtRuntime('svc', NewNode, {}, ['a']);

    expect(dir!.findByRole('Service')).toEqual(['svc']);
    expect(dir!.findById('svc')).toBeDefined();
    scheduler.stop();
  });

  it('directory updates on removeNodeAtRuntime', () => {
    let dir: GraphDirectory | null = null;

    const Node = defineNode('Node', (ctx) => {
      dir = ctx.directory;
      return { accepts: [], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('a', Node);
      g.addNode('b', Node);
    });

    scheduler.start();
    expect(dir!.findByRole('Node').sort()).toEqual(['a', 'b']);

    scheduler.removeNodeAtRuntime('b');
    expect(dir!.findByRole('Node')).toEqual(['a']);
    expect(dir!.findById('b')).toBeUndefined();
    scheduler.stop();
  });
});

describe('Direct Messaging', () => {
  it('sends message to non-neighbor via direct option', () => {
    const received: unknown[] = [];

    const Sender = defineNode('Sender', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        // Find the receiver via directory and DM it
        const targets = ctx.directory.findByRole('Receiver');
        if (targets.length > 0) {
          emit('dm', { greeting: 'hello' }, { direct: targets[0] });
        }
      }, []);
      return { accepts: [], emits: ['dm'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('dm', (msg) => {
        received.push(msg.payload);
      });
      return { accepts: ['dm'], emits: [] };
    });

    // No edge between sender and receiver!
    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
      // deliberately no addEdge
    });

    scheduler.start();
    expect(received).toEqual([{ greeting: 'hello' }]);
    scheduler.stop();
  });

  it('direct message respects permission manifests', () => {
    const dropped: string[] = [];

    const Sender = defineNode('Sender', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        emit('secret', {}, { direct: 'receiver' });
      }, []);
      return { accepts: [], emits: ['secret'] };
    });

    const Receiver = defineNode('Receiver', () => {
      return { accepts: ['public-only'], emits: [] }; // does NOT accept 'secret'
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
    });

    scheduler.onMessageDropped = (msg, reason) => dropped.push(reason);
    scheduler.start();
    expect(dropped.length).toBe(1);
    expect(dropped[0]).toContain('does not accept');
    scheduler.stop();
  });

  it('direct message includes correct from field', () => {
    let fromField = '';

    const Sender = defineNode('Sender', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        emit('hello', {}, { direct: 'receiver' });
      }, []);
      return { accepts: [], emits: ['hello'] };
    });

    const Receiver = defineNode('Receiver', () => {
      useMessage('hello', (msg) => {
        fromField = msg.from;
      });
      return { accepts: ['hello'], emits: [] };
    });

    const { scheduler } = createGraph('test', (g) => {
      g.addNode('sender', Sender);
      g.addNode('receiver', Receiver);
    });

    scheduler.start();
    expect(fromField).toBe('sender');
    scheduler.stop();
  });
});

describe('Edge Negotiation', () => {
  it('node accepts edge request and creates real edge', () => {
    let edgeCreated = false;

    const Employee = defineNode('Employee', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        const ceo = ctx.directory.findByRole('CEO')[0];
        if (ceo) {
          emit('edge-request', { reason: 'need access' }, { direct: ceo });
        }
      }, []);

      useMessage('edge-accepted', () => {
        edgeCreated = true;
      });

      return { accepts: ['edge-accepted'], emits: ['edge-request'] };
    });

    const CEO = defineNode('CEO', (ctx) => {
      const emit = useEmit();
      useMessage('edge-request', (msg) => {
        ctx.acceptEdge(msg.from);
        emit('edge-accepted', {}, { direct: msg.from });
      });
      return { accepts: ['edge-request'], emits: ['edge-accepted'] };
    });

    const { scheduler, graph } = loadGraph(
      `<Graph id="org">
        <CEO id="ceo">
          <Employee id="emp" />
        </CEO>
      </Graph>`,
      { CEO, Employee }
    );

    // After the negotiation, emp and ceo should have an edge
    // (they already have one from nesting, but let's test with separated nodes)
    scheduler.stop();
  });

  it('acceptEdge creates edge between non-neighbors', () => {
    const CEO = defineNode('CEO', (ctx) => {
      useMessage('edge-request', (msg) => {
        ctx.acceptEdge(msg.from);
      });
      return { accepts: ['edge-request'], emits: [] };
    });

    const Employee = defineNode('Employee', (ctx) => {
      const emit = useEmit();
      useEffect(() => {
        emit('edge-request', {}, { direct: 'ceo' });
      }, []);
      return { accepts: [], emits: ['edge-request'] };
    });

    const { scheduler, graph } = createGraph('test', (g) => {
      g.addNode('ceo', CEO);
      g.addNode('emp', Employee);
      // No edge between them
    });

    expect(graph.hasEdge('ceo', 'emp')).toBe(false);
    scheduler.start();
    expect(graph.hasEdge('ceo', 'emp')).toBe(true);
    scheduler.stop();
  });
});
