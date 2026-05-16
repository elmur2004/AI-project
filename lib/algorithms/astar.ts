import type { Cell, SearchResult } from '../maze/types';
import { manhattan, keyOf } from '../utils/helpers';

interface Node {
  cell: Cell;
  g: number;
  f: number;
  parent: Node | null;
}

// Lightweight binary min-heap on f. Avoids O(n) array scans for larger mazes.
class MinHeap {
  private data: Node[] = [];

  push(n: Node) {
    this.data.push(n);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }

  pop(): Node | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
        if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.data.length;
  }
}

export function astar(maze: number[][], start: Cell, goal: Cell): SearchResult {
  const t0 = performance.now();
  const rows = maze.length;
  const cols = maze[0].length;

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const closed = new Set<string>();
  const explorationOrder: Cell[] = [];
  const parents = new Map<string, Cell | null>();

  const startKey = keyOf(start[0], start[1]);
  open.push({ cell: start, g: 0, f: manhattan(start, goal), parent: null });
  gScore.set(startKey, 0);
  parents.set(startKey, null);

  let nodesExplored = 0;
  let foundNode: Node | null = null;

  while (open.size > 0) {
    const current = open.pop()!;
    const key = keyOf(current.cell[0], current.cell[1]);
    if (closed.has(key)) continue;
    closed.add(key);
    explorationOrder.push(current.cell);
    nodesExplored++;

    if (current.cell[0] === goal[0] && current.cell[1] === goal[1]) {
      foundNode = current;
      break;
    }

    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = current.cell[0] + dr;
      const nc = current.cell[1] + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (maze[nr][nc] === 1) continue;
      const nKey = keyOf(nr, nc);
      if (closed.has(nKey)) continue;
      const tentativeG = current.g + 1;
      const prevG = gScore.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(nKey, tentativeG);
        parents.set(nKey, current.cell);
        const f = tentativeG + manhattan([nr, nc], goal);
        open.push({ cell: [nr, nc], g: tentativeG, f, parent: current });
      }
    }
  }

  const path: Cell[] = [];
  if (foundNode) {
    let n: Node | null = foundNode;
    while (n) {
      path.unshift(n.cell);
      n = n.parent;
    }
  }

  return {
    path,
    nodesExplored,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    pathCost: path.length > 0 ? path.length - 1 : 0,
    found: !!foundNode,
  };
}
