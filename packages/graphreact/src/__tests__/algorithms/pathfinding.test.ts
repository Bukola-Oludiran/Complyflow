import { describe, it, expect } from 'vitest';
import { CommunicationGraph } from '../../core/graph/graph.js';
import {
  shortestPath,
  allPaths,
  aStarPath,
} from '../../core/algorithms/pathfinding.js';
import type { EdgeFilter, PathHeuristic } from '../../core/algorithms/pathfinding.js';

// ---- Fixture graphs ----

function makeLinearGraph(): CommunicationGraph {
  // a - b - c - d
  const g = new CommunicationGraph();
  g.addEdge('a', 'b');
  g.addEdge('b', 'c');
  g.addEdge('c', 'd');
  return g;
}

function makeDiamondGraph(): CommunicationGraph {
  //     a
  //    / \
  //   b   c
  //    \ /
  //     d
  const g = new CommunicationGraph();
  g.addEdge('a', 'b');
  g.addEdge('a', 'c');
  g.addEdge('b', 'd');
  g.addEdge('c', 'd');
  return g;
}

function makeGridGraph(): CommunicationGraph {
  // a - b - c
  // |   |   |
  // d - e - f
  // |   |   |
  // g - h - i
  const g = new CommunicationGraph();
  g.addEdge('a', 'b');
  g.addEdge('b', 'c');
  g.addEdge('a', 'd');
  g.addEdge('b', 'e');
  g.addEdge('c', 'f');
  g.addEdge('d', 'e');
  g.addEdge('e', 'f');
  g.addEdge('d', 'g');
  g.addEdge('e', 'h');
  g.addEdge('f', 'i');
  g.addEdge('g', 'h');
  g.addEdge('h', 'i');
  return g;
}

function makeEncryptedGraph(): CommunicationGraph {
  // a --[encrypted]--> b --[encrypted]--> c
  // a --[plain]------> d --[plain]-------> c
  const g = new CommunicationGraph();
  g.addEdge('a', 'b', 'ab', { encryption: 'AES-256' });
  g.addEdge('b', 'c', 'bc', { encryption: 'AES-256' });
  g.addEdge('a', 'd', 'ad', { encryption: 'none' });
  g.addEdge('d', 'c', 'dc', { encryption: 'none' });
  return g;
}

// ---- shortestPath ----

describe('shortestPath', () => {
  it('finds shortest path in linear graph', () => {
    const g = makeLinearGraph();
    expect(shortestPath(g, 'a', 'd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns single-node path when source === target', () => {
    const g = makeLinearGraph();
    expect(shortestPath(g, 'b', 'b')).toEqual(['b']);
  });

  it('finds shortest path in diamond (picks 2-hop path)', () => {
    const g = makeDiamondGraph();
    const path = shortestPath(g, 'a', 'd');
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3); // a -> b/c -> d
    expect(path![0]).toBe('a');
    expect(path![path!.length - 1]).toBe('d');
  });

  it('returns null when no path exists', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c'); // isolated
    expect(shortestPath(g, 'a', 'c')).toBeNull();
  });

  it('throws for nonexistent source', () => {
    const g = makeLinearGraph();
    expect(() => shortestPath(g, 'x', 'a')).toThrow("Node 'x' not in graph");
  });

  it('throws for nonexistent target', () => {
    const g = makeLinearGraph();
    expect(() => shortestPath(g, 'a', 'x')).toThrow("Node 'x' not in graph");
  });

  it('respects edgeFilter', () => {
    const g = makeEncryptedGraph();
    const encryptedOnly: EdgeFilter = (_u, _v, _k, attrs) =>
      attrs.encryption === 'AES-256';

    const path = shortestPath(g, 'a', 'c', { edgeFilter: encryptedOnly });
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('returns null when edgeFilter blocks all paths', () => {
    const g = makeEncryptedGraph();
    const noEdges: EdgeFilter = () => false;
    expect(shortestPath(g, 'a', 'c', { edgeFilter: noEdges })).toBeNull();
  });

  it('finds shortest path in grid graph', () => {
    const g = makeGridGraph();
    const path = shortestPath(g, 'a', 'i');
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5); // 4 hops: a->b->e->f->i or a->d->e->h->i etc.
    expect(path![0]).toBe('a');
    expect(path![path!.length - 1]).toBe('i');
  });
});

// ---- allPaths ----

describe('allPaths', () => {
  it('finds all paths in diamond graph', () => {
    const g = makeDiamondGraph();
    const paths = allPaths(g, 'a', 'd');
    expect(paths.length).toBe(2);
    // Both paths: a->b->d and a->c->d
    expect(paths).toContainEqual(['a', 'b', 'd']);
    expect(paths).toContainEqual(['a', 'c', 'd']);
  });

  it('returns single-node path when source === target', () => {
    expect(allPaths(makeLinearGraph(), 'a', 'a')).toEqual([['a']]);
  });

  it('finds single path in linear graph', () => {
    const g = makeLinearGraph();
    const paths = allPaths(g, 'a', 'd');
    expect(paths).toEqual([['a', 'b', 'c', 'd']]);
  });

  it('returns empty array when no path exists', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c');
    expect(allPaths(g, 'a', 'c')).toEqual([]);
  });

  it('respects maxDepth', () => {
    const g = makeDiamondGraph();
    // Add a longer path: a -> e -> f -> d
    g.addEdge('a', 'e');
    g.addEdge('e', 'f');
    g.addEdge('f', 'd');

    const shortOnly = allPaths(g, 'a', 'd', { maxDepth: 2 });
    // Only 2-hop paths should be returned (a->b->d, a->c->d)
    expect(shortOnly.every((p) => p.length <= 3)).toBe(true);
    expect(shortOnly).toContainEqual(['a', 'b', 'd']);
    expect(shortOnly).toContainEqual(['a', 'c', 'd']);
  });

  it('respects edgeFilter', () => {
    const g = makeEncryptedGraph();
    const encryptedOnly: EdgeFilter = (_u, _v, _k, attrs) =>
      attrs.encryption === 'AES-256';

    const paths = allPaths(g, 'a', 'c', { edgeFilter: encryptedOnly });
    expect(paths).toEqual([['a', 'b', 'c']]);
  });

  it('finds multiple paths in grid graph', () => {
    const g = makeGridGraph();
    const paths = allPaths(g, 'a', 'i');
    // Should find multiple distinct paths
    expect(paths.length).toBeGreaterThan(1);
    // All paths start at a and end at i
    for (const p of paths) {
      expect(p[0]).toBe('a');
      expect(p[p.length - 1]).toBe('i');
    }
    // All paths are simple (no repeated nodes)
    for (const p of paths) {
      expect(new Set(p).size).toBe(p.length);
    }
  });

  it('throws for nonexistent nodes', () => {
    const g = makeLinearGraph();
    expect(() => allPaths(g, 'x', 'a')).toThrow();
    expect(() => allPaths(g, 'a', 'x')).toThrow();
  });
});

// ---- aStarPath ----

describe('aStarPath', () => {
  it('finds shortest path without heuristic (degrades to Dijkstra)', () => {
    const g = makeLinearGraph();
    expect(aStarPath(g, 'a', 'd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns single-node path when source === target', () => {
    expect(aStarPath(makeLinearGraph(), 'b', 'b')).toEqual(['b']);
  });

  it('returns null when no path exists', () => {
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addNode('c');
    expect(aStarPath(g, 'a', 'c')).toBeNull();
  });

  it('uses heuristic to guide search', () => {
    const g = makeGridGraph();
    // Assign coordinates as node attributes
    const coords: Record<string, [number, number]> = {
      a: [0, 0], b: [1, 0], c: [2, 0],
      d: [0, 1], e: [1, 1], f: [2, 1],
      g: [0, 2], h: [1, 2], i: [2, 2],
    };
    for (const [id, [x, y]] of Object.entries(coords)) {
      // addNode merges attrs if node exists
      g.addNode(id, { x, y });
    }

    const manhattanHeuristic: PathHeuristic = (current, target, graph) => {
      const cData = graph.getNodeData(current);
      const tData = graph.getNodeData(target);
      return (
        Math.abs((cData.x as number) - (tData.x as number)) +
        Math.abs((cData.y as number) - (tData.y as number))
      );
    };

    const path = aStarPath(g, 'a', 'i', { heuristic: manhattanHeuristic });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5); // optimal: 4 hops
    expect(path![0]).toBe('a');
    expect(path![path!.length - 1]).toBe('i');
  });

  it('respects edgeFilter', () => {
    const g = makeEncryptedGraph();
    const encryptedOnly: EdgeFilter = (_u, _v, _k, attrs) =>
      attrs.encryption === 'AES-256';

    const path = aStarPath(g, 'a', 'c', { edgeFilter: encryptedOnly });
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('heuristic with penalty steers away from undesirable nodes', () => {
    // Two paths: a->b->c (b is penalized) and a->d->c (d is clean)
    const g = new CommunicationGraph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('a', 'd');
    g.addEdge('d', 'c');

    g.addNode('b', { thirdParty: true });
    g.addNode('d', { thirdParty: false });

    const avoidThirdParty: PathHeuristic = (current, _target, graph) => {
      const data = graph.getNodeData(current);
      return data.thirdParty ? 10 : 0;
    };

    const path = aStarPath(g, 'a', 'c', { heuristic: avoidThirdParty });
    expect(path).toEqual(['a', 'd', 'c']);
  });

  it('throws for nonexistent nodes', () => {
    const g = makeLinearGraph();
    expect(() => aStarPath(g, 'x', 'a')).toThrow();
    expect(() => aStarPath(g, 'a', 'x')).toThrow();
  });

  it('finds path in diamond graph', () => {
    const g = makeDiamondGraph();
    const path = aStarPath(g, 'a', 'd');
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(path![0]).toBe('a');
    expect(path![path!.length - 1]).toBe('d');
  });
});
