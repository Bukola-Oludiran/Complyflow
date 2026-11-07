/**
 * Ping-Pong example: Two nodes bouncing messages in a cycle.
 * Demonstrates cycle handling and TTL-based termination.
 */

import { defineNode, useState, useEffect, useMessage, useEmit, loadGraph } from '../core/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Node definitions ---

const PingNode = defineNode('Ping', () => {
  const [count, setCount] = useState(0);
  const emit = useEmit();

  useMessage('pong', (msg) => {
    console.log(`  Ping received pong #${count + 1}`);
    setCount(prev => prev + 1);
    emit('ping', { bounce: count + 1 });
  });

  useEffect(() => {
    console.log('  Ping: starting rally');
    emit('ping', { bounce: 0 });
  }, []);

  return { accepts: ['pong'], emits: ['ping'] };
});

const PongNode = defineNode('Pong', () => {
  const [count, setCount] = useState(0);
  const emit = useEmit();

  useMessage('ping', (msg) => {
    console.log(`  Pong received ping #${count + 1}`);
    setCount(prev => prev + 1);
    emit('pong', { bounce: count + 1 });
  });

  return { accepts: ['ping'], emits: ['pong'] };
});

// --- Bootstrap ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const grxSource = readFileSync(join(__dirname, 'ping-pong.grx'), 'utf-8');

console.log('=== Ping-Pong Example ===');
const { scheduler } = loadGraph(grxSource, { Ping: PingNode, Pong: PongNode });
console.log('=== Done (TTL stopped the loop) ===');
