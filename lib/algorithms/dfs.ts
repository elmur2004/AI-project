import type { Cell, SearchResult } from '../maze/types';
import { keyOf } from '../utils/helpers';

/**
 * Depth-first search on a 4-connected grid maze.
 *
 * DFS commits to one branch and only backtracks when it has nowhere to go.
 * It finds *a* path to the goal — not necessarily the shortest. Compared to
 * BFS, the tree it builds is deeper and narrower, and the exploration order
 * follows a single corridor at a time rather than expanding in waves.
 */
export function dfs(maze: number[][], start: Cell, goal: Cell): SearchResult {
  const t0 = performance.now();
  const rows = maze.length;
  const cols = maze[0].length;

  const parents = new Map<string, Cell | null>();
  const visited = new Set<string>();
  const explorationOrder: Cell[] = [];
  const stack: Cell[] = [];

  const startKey = keyOf(start[0], start[1]);
  visited.add(startKey);
  parents.set(startKey, null);
  stack.push(start);

  let foundKey: string | null = null;

  while (stack.length > 0) {
    const current = stack.pop()!;
    explorationOrder.push(current);

    if (current[0] === goal[0] && current[1] === goal[1]) {
      foundKey = keyOf(current[0], current[1]);
      break;
    }

    // Push neighbors in reverse so popping yields UP first (cosmetic; helps the
    // animation look consistent with BFS's order).
    const dirs: Cell[] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dr, dc] of dirs) {
      const nr = current[0] + dr;
      const nc = current[1] + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (maze[nr][nc] === 1) continue;
      const nKey = keyOf(nr, nc);
      if (visited.has(nKey)) continue;
      visited.add(nKey);
      parents.set(nKey, current);
      stack.push([nr, nc]);
    }
  }

  // Reconstruct path
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
