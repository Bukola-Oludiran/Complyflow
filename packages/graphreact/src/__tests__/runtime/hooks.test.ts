import { describe, it, expect, beforeEach } from 'vitest';
import { defineNode } from '../../core/dsl/define-node.js';
import { createGraph } from '../../core/dsl/create-graph.js';
import { useState, useEffect, useMemo } from '../../core/runtime/hooks.js';

describe('Hooks', () => {
  describe('useState', () => {
    it('initializes state on first evaluation', () => {
      let capturedCount = -1;

      const Counter = defineNode('Counter', (ctx) => {
        const [count] = useState(42);
        capturedCount = count;
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('c', Counter);
      });

      scheduler.start();
      expect(capturedCount).toBe(42);
    });

    it('updates state and triggers re-evaluation', () => {
      const values: number[] = [];
      let setCount: ((v: number | ((p: number) => number)) => void) | null = null;

      const Counter = defineNode('Counter', (ctx) => {
        const [count, _setCount] = useState(0);
        values.push(count);
        setCount = _setCount;
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('c', Counter);
      });

      scheduler.start();
      expect(values).toEqual([0]);

      // Update state
      setCount!(5);
      scheduler.processSync();
      expect(values).toEqual([0, 5]);
    });

    it('supports functional updates', () => {
      let setCount: ((v: number | ((p: number) => number)) => void) | null = null;
      let lastCount = -1;

      const Counter = defineNode('Counter', (ctx) => {
        const [count, _setCount] = useState(0);
        lastCount = count;
        setCount = _setCount;
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('c', Counter);
      });

      scheduler.start();
      setCount!(prev => prev + 1);
      setCount!(prev => prev + 1);
      scheduler.processSync();
      // Both updates should batch, but each reads the latest pending value
      expect(lastCount).toBe(2);
    });
  });

  describe('useEffect', () => {
    it('runs effect on mount with empty deps', () => {
      let mounted = false;

      const Node = defineNode('Node', () => {
        useEffect(() => {
          mounted = true;
        }, []);
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('n', Node);
      });

      scheduler.start();
      expect(mounted).toBe(true);
    });

    it('runs cleanup on re-evaluation', () => {
      let cleanupCount = 0;
      let setState: ((v: number) => void) | null = null;

      const Node = defineNode('Node', () => {
        const [val, _set] = useState(0);
        setState = _set;
        useEffect(() => {
          return () => { cleanupCount++; };
        }, [val]);
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('n', Node);
      });

      scheduler.start();
      expect(cleanupCount).toBe(0);

      setState!(1);
      scheduler.processSync();
      expect(cleanupCount).toBe(1); // cleanup from first effect
    });

    it('skips effect when deps unchanged', () => {
      let effectCount = 0;
      let setState: ((v: number) => void) | null = null;

      const Node = defineNode('Node', () => {
        const [, _set] = useState(0);
        setState = _set;
        useEffect(() => {
          effectCount++;
        }, []); // empty deps — should only run once
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('n', Node);
      });

      scheduler.start();
      expect(effectCount).toBe(1);

      setState!(1);
      scheduler.processSync();
      expect(effectCount).toBe(1); // not re-run
    });
  });

  describe('useMemo', () => {
    it('memoizes computation', () => {
      let computeCount = 0;
      let setState: ((v: number) => void) | null = null;
      let lastResult = '';

      const Node = defineNode('Node', () => {
        const [val, _set] = useState(0);
        setState = _set;
        const result = useMemo(() => {
          computeCount++;
          return `computed-${val}`;
        }, [val]);
        lastResult = result;
        return { accepts: [], emits: [] };
      });

      const { scheduler } = createGraph('test', (g) => {
        g.addNode('n', Node);
      });

      scheduler.start();
      expect(computeCount).toBe(1);
      expect(lastResult).toBe('computed-0');

      setState!(0); // same value — useMemo deps unchanged
      scheduler.processSync();
      // Note: useState won't trigger re-eval if value is same (Object.is)
      // so computeCount stays 1
      expect(computeCount).toBe(1);
    });
  });
});
