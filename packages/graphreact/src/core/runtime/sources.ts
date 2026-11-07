/**
 * Event sources — external event integrations for GraphReact nodes.
 *
 * An EventSource produces events over time (HTTP requests, timer ticks,
 * file changes, etc.) and pushes them into the graph as messages.
 * Sources are managed by the useSource hook and tied to node lifecycle.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { watch, type FSWatcher } from 'fs';

/** Interface for all event sources */
export interface EventSource {
  /** Unique ID for this source instance */
  id: string;
  /** Start producing events. Call `push(type, payload)` when events arrive. */
  start(push: (type: string, payload: unknown) => void): void;
  /** Stop producing events. Clean up resources. */
  stop(): void | Promise<void>;
}

/** Factory type for creating event sources */
export type EventSourceFactory = () => EventSource;

let sourceCounter = 0;

/**
 * Repeating timer source — emits 'tick' at a fixed interval.
 */
export function timerSource(intervalMs: number): EventSource {
  let handle: ReturnType<typeof setInterval> | undefined;
  const id = `timer-${++sourceCounter}`;

  return {
    id,
    start(push) {
      handle = setInterval(() => {
        push('tick', { time: Date.now() });
      }, intervalMs);
    },
    stop() {
      if (handle !== undefined) {
        clearInterval(handle);
        handle = undefined;
      }
    },
  };
}

/**
 * One-shot delay source — emits 'timeout' once after a delay.
 */
export function delaySource(ms: number): EventSource {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const id = `delay-${++sourceCounter}`;

  return {
    id,
    start(push) {
      handle = setTimeout(() => {
        push('timeout', { time: Date.now() });
        handle = undefined;
      }, ms);
    },
    stop() {
      if (handle !== undefined) {
        clearTimeout(handle);
        handle = undefined;
      }
    },
  };
}

/**
 * HTTP server source — emits 'request' for each incoming HTTP request.
 */
export function httpSource(port: number): EventSource {
  let server: Server | undefined;
  const id = `http-${++sourceCounter}`;

  return {
    id,
    start(push) {
      server = createServer((req: IncomingMessage, res: ServerResponse) => {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          push('request', {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: body || undefined,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        });
      });
      server.listen(port);
    },
    async stop() {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = undefined;
      }
    },
  };
}

/**
 * File watcher source — emits 'change' when a file or directory changes.
 */
export function watchSource(path: string): EventSource {
  let watcher: FSWatcher | undefined;
  const id = `watch-${++sourceCounter}`;

  return {
    id,
    start(push) {
      watcher = watch(path, { recursive: true }, (eventType, filename) => {
        push('change', { eventType, filename, path });
      });
    },
    stop() {
      if (watcher) {
        watcher.close();
        watcher = undefined;
      }
    },
  };
}

/** Reset source counter (for testing) */
export function resetSourceCounter(): void {
  sourceCounter = 0;
}
