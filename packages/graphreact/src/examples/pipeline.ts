/**
 * Pipeline example: Linear chain of processing nodes.
 * Source → Transform → Sink
 * Demonstrates simple data flow through a chain.
 */

import { defineNode, useState, useEffect, useMessage, useEmit, loadGraph } from '../core/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Node definitions ---

const Source = defineNode('Source', (ctx) => {
  const emit = useEmit();

  useMessage('produce', (msg) => {
    const data = msg.payload as { items: number[] };
    console.log(`  Source: producing ${data.items.length} items`);
    for (const item of data.items) {
      emit('raw-data', { value: item });
    }
  });

  return { accepts: ['produce'], emits: ['raw-data'] };
});

const Transform = defineNode('Transform', (ctx) => {
  const emit = useEmit();

  useMessage('raw-data', (msg) => {
    const { value } = msg.payload as { value: number };
    const transformed = value * 2;
    console.log(`  Transform: ${value} → ${transformed}`);
    emit('transformed-data', { value: transformed });
  });

  return { accepts: ['raw-data'], emits: ['transformed-data'] };
});

const Sink = defineNode('Sink', (ctx) => {
  const [results, setResults] = useState<number[]>([]);

  useMessage('transformed-data', (msg) => {
    const { value } = msg.payload as { value: number };
    setResults(prev => [...prev, value]);
  });

  useEffect(() => {
    if (results.length > 0) {
      console.log(`  Sink: collected [${results.join(', ')}]`);
    }
  }, [results]);

  return { accepts: ['transformed-data'], emits: [] };
});

// --- Bootstrap ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const grxSource = readFileSync(join(__dirname, 'pipeline.grx'), 'utf-8');

console.log('=== Pipeline Example ===');
const { scheduler } = loadGraph(grxSource, { Source, Transform, Sink });

console.log('\n--- Feeding data into pipeline ---');
scheduler.send('source', 'produce', { items: [1, 2, 3, 4, 5] });

console.log('=== Done ===');
