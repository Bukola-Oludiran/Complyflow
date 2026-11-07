/**
 * DAG algorithms — topological sort for directed acyclic subgraphs.
 *
 * Since CommunicationGraph is undirected, these functions work on a
 * "directed view" where parent-child nesting defines direction.
 * The direction map is provided externally (e.g., from .grx nesting).
 *
 * Also includes a general Kahn's algorithm for directed adjacency lists.
 * Ported from NetworkX (networkx/algorithms/dag.py).
 */

/**
 * Topological sort using Kahn's algorithm.
 * Takes a directed adjacency list (node → list of nodes it points to).
 * Returns nodes in topological order, or throws if a cycle exists.
 *
 * Ported from NetworkX topological_sort() / topological_generations().
 */
export function topologicalSort(directedAdj: Map<string, string[]>): string[] {
  // Compute in-degrees
  const inDegree = new Map<string, number>();
  for (const node of directedAdj.keys()) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    for (const target of directedAdj.get(node)!) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      // Ensure target is in directedAdj even if it has no outgoing edges
      if (!directedAdj.has(target)) directedAdj.set(target, []);
    }
  }

  // Start with nodes that have in-degree 0
  const queue: string[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const target of directedAdj.get(node) ?? []) {
      const newDeg = inDegree.get(target)! - 1;
      inDegree.set(target, newDeg);
      if (newDeg === 0) {
        queue.push(target);
      }
    }
  }

  if (result.length !== inDegree.size) {
    throw new Error(
      'Graph contains a cycle — topological sort is not possible. ' +
      `Sorted ${result.length} of ${inDegree.size} nodes.`
    );
  }

  return result;
}

/**
 * Topological generations — groups nodes into layers where all
 * dependencies of a layer are in earlier layers.
 *
 * Ported from NetworkX topological_generations().
 */
export function topologicalGenerations(directedAdj: Map<string, string[]>): string[][] {
  const inDegree = new Map<string, number>();
  for (const node of directedAdj.keys()) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    for (const target of directedAdj.get(node)!) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      if (!directedAdj.has(target)) directedAdj.set(target, []);
    }
  }

  let currentGen: string[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) currentGen.push(node);
  }

  const generations: string[][] = [];
  let totalProcessed = 0;

  while (currentGen.length > 0) {
    generations.push([...currentGen]);
    totalProcessed += currentGen.length;

    const nextGen: string[] = [];
    for (const node of currentGen) {
      for (const target of directedAdj.get(node) ?? []) {
        const newDeg = inDegree.get(target)! - 1;
        inDegree.set(target, newDeg);
        if (newDeg === 0) {
          nextGen.push(target);
        }
      }
    }
    currentGen = nextGen;
  }

  if (totalProcessed !== inDegree.size) {
    throw new Error('Graph contains a cycle — topological generations not possible.');
  }

  return generations;
}
