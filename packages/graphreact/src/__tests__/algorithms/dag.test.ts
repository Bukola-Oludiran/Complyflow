import { describe, it, expect } from 'vitest';
import { topologicalSort, topologicalGenerations } from '../../core/algorithms/dag.js';

describe('Topological sort', () => {
  it('sorts a simple DAG', () => {
    const adj = new Map([
      ['a', ['b', 'c']],
      ['b', ['d']],
      ['c', ['d']],
      ['d', []],
    ]);
    const result = topologicalSort(adj);
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('c'));
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('d'));
    expect(result.indexOf('c')).toBeLessThan(result.indexOf('d'));
  });

  it('throws on cycle', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);
    expect(() => topologicalSort(adj)).toThrow('cycle');
  });

  it('handles single node', () => {
    const adj = new Map([['a', [] as string[]]]);
    expect(topologicalSort(adj)).toEqual(['a']);
  });
});

describe('Topological generations', () => {
  it('groups nodes into layers', () => {
    const adj = new Map([
      ['a', ['c']],
      ['b', ['c']],
      ['c', ['d']],
      ['d', []],
    ]);
    const gens = topologicalGenerations(adj);
    expect(gens.length).toBe(3);
    expect(gens[0].sort()).toEqual(['a', 'b']); // both have in-degree 0
    expect(gens[1]).toEqual(['c']);
    expect(gens[2]).toEqual(['d']);
  });

  it('throws on cycle', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    expect(() => topologicalGenerations(adj)).toThrow('cycle');
  });
});
