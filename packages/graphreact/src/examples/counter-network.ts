/**
 * Counter Network example: Fan-in aggregation pattern.
 * Two counters feed into an aggregator and a logger.
 * Demonstrates multi-parent, state, and reactive effects.
 */

import { defineNode, useState, useEffect, useMessage, useEmit, loadGraph } from '../core/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Node definitions ---

const Counter = defineNode('Counter', (ctx) => {
  const [count, setCount] = useState(ctx.props.initialCount as number ?? 0);
  const emit = useEmit();

  useMessage('increment', () => {
    setCount(prev => prev + 1);
  });

  useEffect(() => {
    console.log(`  Counter [${ctx.id}] count = ${count}`);
    emit('count-updated', { nodeId: ctx.id, value: count });
  }, [count]);

  return { accepts: ['increment'], emits: ['count-updated'] };
});

const Aggregator = defineNode('Aggregator', (ctx) => {
  const [total, setTotal] = useState(0);
  const emit = useEmit();

  useMessage('count-updated', (msg) => {
    const { value } = msg.payload as { nodeId: string; value: number };
    setTotal(prev => prev + value);
  });

  useEffect(() => {
    console.log(`  Aggregator [${ctx.id}] total = ${total}`);
    emit('total-updated', { total });
  }, [total]);

  return { accepts: ['count-updated'], emits: ['total-updated'] };
});

const Logger = defineNode('Logger', (ctx) => {
  useMessage('count-updated', (msg) => {
    const { nodeId, value } = msg.payload as { nodeId: string; value: number };
    console.log(`  Logger: ${nodeId} → ${value}`);
  });

  return { accepts: ['count-updated', 'total-updated'], emits: [] };
});

// --- Bootstrap ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const grxSource = readFileSync(join(__dirname, 'counter-network.grx'), 'utf-8');

console.log('=== Counter Network Example ===');
const { scheduler } = loadGraph(grxSource, { Counter, Aggregator, Logger });

console.log('\n--- Sending increment to counter-a ---');
scheduler.send('counter-a', 'increment', {});

console.log('\n--- Sending increment to counter-b ---');
scheduler.send('counter-b', 'increment', {});

console.log('=== Done ===');
