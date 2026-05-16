import type { GraphMaze, GraphSearchResult, GraphAlgorithmId } from './types';
import { adjacencyMap } from './generator';

function euclidean(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Reconstruct path from a parents map.
function reconstruct(parents: Map<string, string | null>, goal: string): string[] {
  const path: string[] = [];
  let cur: string | null = goal;
  while (cur !== null) {
    path.unshift(cur);
    cur = parents.get(cur) ?? null;
    if (path.length > parents.size + 1) break; // guard against cycles
  }
  return path;
}

function pathCost(graph: GraphMaze, path: string[]): number {
  if (path.length < 2) return 0;
  const adj = adjacencyMap(graph.nodes, graph.edges);
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const neighbors = adj.get(path[i - 1]) ?? [];
    const edge = neighbors.find((n) => n.to === path[i]);
    if (!edge) return Number.NaN;
    total += edge.cost;
  }
  return total;
}

// ----- BFS (ignores edge cost) --------------------------------------------
export function bfsGraph(graph: GraphMaze): GraphSearchResult {
  const t0 = performance.now();
  const adj = adjacencyMap(graph.nodes, graph.edges);
  const visited = new Set<string>([graph.startId]);
  const parents = new Map<string, string | null>([[graph.startId, null]]);
  const explorationOrder: string[] = [];
  const queue: string[] = [graph.startId];
  let head = 0;
  let found = false;

  while (head < queue.length) {
    const cur = queue[head++];
    explorationOrder.push(cur);
    if (cur === graph.goalId) {
      found = true;
      break;
    }
    for (const { to } of adj.get(cur) ?? []) {
      if (visited.has(to)) continue;
      visited.add(to);
      parents.set(to, cur);
      queue.push(to);
    }
  }

  const path = found ? reconstruct(parents, graph.goalId) : [];
  return {
    path,
    pathCost: pathCost(graph, path),
    nodesExplored: explorationOrder.length,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    found,
    algorithm: 'bfs',
  };
}

// ----- DFS (ignores edge cost) --------------------------------------------
export function dfsGraph(graph: GraphMaze): GraphSearchResult {
  const t0 = performance.now();
  const adj = adjacencyMap(graph.nodes, graph.edges);
  const visited = new Set<string>([graph.startId]);
  const parents = new Map<string, string | null>([[graph.startId, null]]);
  const explorationOrder: string[] = [];
  const stack: string[] = [graph.startId];
  let found = false;

  while (stack.length > 0) {
    const cur = stack.pop()!;
    explorationOrder.push(cur);
    if (cur === graph.goalId) {
      found = true;
      break;
    }
    const neighbors = (adj.get(cur) ?? []).slice().sort((a, b) => a.to.localeCompare(b.to));
    // push in reverse so the smallest-id neighbor is explored first (popped last)
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const { to } = neighbors[i];
      if (visited.has(to)) continue;
      visited.add(to);
      parents.set(to, cur);
      stack.push(to);
    }
  }

  const path = found ? reconstruct(parents, graph.goalId) : [];
  return {
    path,
    pathCost: pathCost(graph, path),
    nodesExplored: explorationOrder.length,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    found,
    algorithm: 'dfs',
  };
}

// ----- Dijkstra (uses edge cost) -----------------------------------------
interface PQItem {
  id: string;
  dist: number;
}

class MinHeap<T extends { dist: number }> {
  private data: T[] = [];
  push(x: T) {
    this.data.push(x);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].dist <= this.data[i].dist) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  pop(): T | undefined {
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

export function dijkstraGraph(graph: GraphMaze): GraphSearchResult {
  const t0 = performance.now();
  const adj = adjacencyMap(graph.nodes, graph.edges);
  const dist = new Map<string, number>();
  const parents = new Map<string, string | null>();
  const closed = new Set<string>();
  const explorationOrder: string[] = [];
  const open = new MinHeap<PQItem>();

  dist.set(graph.startId, 0);
  parents.set(graph.startId, null);
  open.push({ id: graph.startId, dist: 0 });
  let found = false;

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    explorationOrder.push(cur.id);
    if (cur.id === graph.goalId) {
      found = true;
      break;
    }
    for (const { to, cost } of adj.get(cur.id) ?? []) {
      if (closed.has(to)) continue;
      const newDist = cur.dist + cost;
      const prev = dist.get(to);
      if (prev === undefined || newDist < prev) {
        dist.set(to, newDist);
        parents.set(to, cur.id);
        open.push({ id: to, dist: newDist });
      }
    }
  }

  const path = found ? reconstruct(parents, graph.goalId) : [];
  return {
    path,
    pathCost: pathCost(graph, path),
    nodesExplored: explorationOrder.length,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    found,
    algorithm: 'dijkstra',
  };
}

// ----- A* with Euclidean-distance heuristic ------------------------------
interface AStarItem {
  id: string;
  g: number;
  dist: number; // f = g + h, stored as dist for the heap
}

export function astarGraph(graph: GraphMaze): GraphSearchResult {
  const t0 = performance.now();
  const adj = adjacencyMap(graph.nodes, graph.edges);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const goalNode = nodeById.get(graph.goalId)!;
  // Heuristic must be in the same units as edge cost; our edges are scaled
  // Euclidean distance (~×60), so we scale h the same way for admissibility.
  const HEURISTIC_SCALE = 60;
  const h = (id: string) => {
    const n = nodeById.get(id)!;
    return euclidean(n, goalNode) * HEURISTIC_SCALE;
  };

  const gScore = new Map<string, number>([[graph.startId, 0]]);
  const parents = new Map<string, string | null>([[graph.startId, null]]);
  const closed = new Set<string>();
  const explorationOrder: string[] = [];
  const open = new MinHeap<AStarItem>();
  open.push({ id: graph.startId, g: 0, dist: h(graph.startId) });
  let found = false;

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    explorationOrder.push(cur.id);
    if (cur.id === graph.goalId) {
      found = true;
      break;
    }
    for (const { to, cost } of adj.get(cur.id) ?? []) {
      if (closed.has(to)) continue;
      const tentativeG = cur.g + cost;
      const prevG = gScore.get(to);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(to, tentativeG);
        parents.set(to, cur.id);
        open.push({ id: to, g: tentativeG, dist: tentativeG + h(to) });
      }
    }
  }

  const path = found ? reconstruct(parents, graph.goalId) : [];
  return {
    path,
    pathCost: pathCost(graph, path),
    nodesExplored: explorationOrder.length,
    executionTime: performance.now() - t0,
    explorationOrder,
    parents,
    found,
    algorithm: 'astar',
  };
}

export const GRAPH_SEARCH: Record<GraphAlgorithmId, (g: GraphMaze) => GraphSearchResult> = {
  bfs: bfsGraph,
  dfs: dfsGraph,
  dijkstra: dijkstraGraph,
  astar: astarGraph,
};
