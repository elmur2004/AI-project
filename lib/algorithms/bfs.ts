import type { Cell, SearchResult } from '../maze/types';
import { keyOf } from '../utils/helpers';

/**
 * Breadth-first search on a 4-connected grid maze.
 *
 * BFS guarantees the shortest path in an *unweighted* graph because it expands
 * nodes in order of their distance (in edges) from the start.
 *
 * It also produces a clean search tree: each cell has exactly one parent (the
 * cell from which it was first discovered), and the tree levels correspond to
 * BFS frontiers.
 */
export function bfs(maze: number[][], start: Cell, goal: Cell): SearchResult {
  const t0 = performance.now();
  const rows = maze.length;
  const cols = maze[0].length;

  const parents = new Map<string, Cell | null>();
  const visited = new Set<string>();
  const explorationOrder: Cell[] = [];
  const queue: Cell[] = [];

  const startKey = keyOf(start[0], start[1]);
  visited.add(startKey);
  parents.set(startKey, null);
  queue.push(start);

  let foundKey: string | null = null;
  let head = 0; // queue index pointer to avoid O(n) shift cost

  while (head < queue.length) {
    const current = queue[head++];
    explorationOrder.push(current);

    if (current[0] === goal[0] && current[1] === goal[1]) {
      foundKey = keyOf(current[0], current[1]);
      break;
    }

    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = current[0] + dr;
      const nc = current[1] + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (maze[nr][nc] === 1) continue;
      const nKey = keyOf(nr, nc);
      if (visited.has(nKey)) continue;
      visited.add(nKey);
      parents.set(nKey, current);
      queue.push([nr, nc]);
    }
  }

  // Reconstruct path by walking parent pointers from goal back to start.
  const path: Cell[] = [];
  if (foundKey) {
    let cursor: Cell | null = goal;
    while (cursor) {
      path.unshift(cursor);
      const p = parents.get(keyOf(cursor[0], cursor[1]));
      cursor = p ?? null;
    }
  }

  return {
    path,
    nodesExplored: explorationOrder.length,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    pathCost: path.length > 0 ? path.length - 1 : 0,
    found: !!foundKey,
  };
}
