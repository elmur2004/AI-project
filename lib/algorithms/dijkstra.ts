import type { Cell, SearchResult } from '../maze/types';
import { keyOf } from '../utils/helpers';

interface Node {
  cell: Cell;
  dist: number;
  parent: Node | null;
}

class MinHeap {
  private data: Node[] = [];

  push(n: Node) {
    this.data.push(n);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].dist <= this.data[i].dist) break;
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
        if (l < n && this.data[l].dist < this.data[smallest].dist) smallest = l;
        if (r < n && this.data[r].dist < this.data[smallest].dist) smallest = r;
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

export function dijkstra(maze: number[][], start: Cell, goal: Cell): SearchResult {
  const t0 = performance.now();
  const rows = maze.length;
  const cols = maze[0].length;

  const dist = new Map<string, number>();
  const closed = new Set<string>();
  const explorationOrder: Cell[] = [];
  const parents = new Map<string, Cell | null>();
  const open = new MinHeap();

  open.push({ cell: start, dist: 0, parent: null });
  dist.set(keyOf(start[0], start[1]), 0);
  parents.set(keyOf(start[0], start[1]), null);

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
      const newDist = current.dist + 1;
      const prev = dist.get(nKey);
      if (prev === undefined || newDist < prev) {
        dist.set(nKey, newDist);
        parents.set(nKey, current.cell);
        open.push({ cell: [nr, nc], dist: newDist, parent: current });
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
