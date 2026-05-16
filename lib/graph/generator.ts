import type { GraphMaze, GraphNode, GraphEdge } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function nodeLabel(i: number): string {
  if (i < LETTERS.length) return LETTERS[i];
  return `N${i}`;
}

// Distance in normalized units, mapped to an integer cost in [1, 99].
function distanceCost(a: GraphNode, b: GraphNode): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return Math.max(1, Math.round(d * 60));
}

/**
 * Build a Poisson-disc-ish set of nodes (rejection sampling) and connect each
 * node to a few of its nearest neighbors. Edge cost is proportional to
 * Euclidean distance, so A* with a Euclidean heuristic is admissible.
 *
 * Then we verify start→goal reachability via BFS; if disconnected, we add
 * bridging edges between the two nearest cross-component nodes until the
 * graph is connected.
 */
export function generateGraphMaze(
  numNodes: number,
  options: { connectivity?: number; minDistance?: number } = {}
): GraphMaze {
  const connectivity = options.connectivity ?? 3;
  const minDistance = options.minDistance ?? 0.12;

  // 1. Place nodes
  const nodes: GraphNode[] = [];
  let attempts = 0;
  while (nodes.length < numNodes && attempts < numNodes * 200) {
    attempts++;
    const x = 0.05 + Math.random() * 0.9;
    const y = 0.05 + Math.random() * 0.9;
    let ok = true;
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.y - y) < minDistance) {
        ok = false;
        break;
      }
    }
    if (ok) {
      nodes.push({ id: nodeLabel(nodes.length), label: nodeLabel(nodes.length), x, y });
    }
  }

  // Fallback: relax minDistance if we couldn't place enough nodes
  if (nodes.length < numNodes) {
    return generateGraphMaze(numNodes, {
      connectivity,
      minDistance: minDistance * 0.7,
    });
  }

  // 2. Connect each node to its k nearest neighbors (undirected)
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edges = new Map<string, GraphEdge>();
  for (const n of nodes) {
    const others = nodes
      .filter((m) => m.id !== n.id)
      .map((m) => ({ m, d: Math.hypot(n.x - m.x, n.y - m.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, connectivity);
    for (const { m } of others) {
      const k = edgeKey(n.id, m.id);
      if (!edges.has(k)) {
        edges.set(k, { from: n.id, to: m.id, cost: distanceCost(n, m) });
      }
    }
  }

  // 3. Pick start = leftmost, goal = rightmost (most visually intuitive)
  const sorted = nodes.slice().sort((a, b) => a.x - b.x);
  const startId = sorted[0].id;
  const goalId = sorted[sorted.length - 1].id;

  // 4. Verify connectivity; if disconnected, bridge the largest two components
  let edgeList = Array.from(edges.values());
  while (!isReachable(nodes, edgeList, startId, goalId)) {
    const components = findComponents(nodes, edgeList);
    if (components.length < 2) break;
    // Find closest pair between components
    let bestA: GraphNode | null = null;
    let bestB: GraphNode | null = null;
    let bestD = Infinity;
    for (let i = 0; i < components.length - 1; i++) {
      for (const a of components[i]) {
        for (let j = i + 1; j < components.length; j++) {
          for (const b of components[j]) {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < bestD) {
              bestD = d;
              bestA = a;
              bestB = b;
            }
          }
        }
      }
    }
    if (bestA && bestB) {
      const k = edgeKey(bestA.id, bestB.id);
      if (!edges.has(k)) {
        edges.set(k, { from: bestA.id, to: bestB.id, cost: distanceCost(bestA, bestB) });
      }
      edgeList = Array.from(edges.values());
    } else {
      break;
    }
  }

  return { nodes, edges: edgeList, startId, goalId };
}

function isReachable(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  goalId: string
): boolean {
  const adj = adjacencyMap(nodes, edges);
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === goalId) return true;
    for (const { to } of adj.get(cur) ?? []) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
    }
  }
  return false;
}

function findComponents(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[][] {
  const adj = adjacencyMap(nodes, edges);
  const visited = new Set<string>();
  const components: GraphNode[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp: GraphNode[] = [];
    const queue = [n.id];
    visited.add(n.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const node = nodes.find((x) => x.id === cur)!;
      comp.push(node);
      for (const { to } of adj.get(cur) ?? []) {
        if (!visited.has(to)) {
          visited.add(to);
          queue.push(to);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

export function adjacencyMap(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, { to: string; cost: number }[]> {
  const adj = new Map<string, { to: string; cost: number }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.from)!.push({ to: e.to, cost: e.cost });
    adj.get(e.to)!.push({ to: e.from, cost: e.cost });
  }
  return adj;
}

// Hand-crafted preset modeled after the Romania map (Russell & Norvig).
export function romaniaMap(): GraphMaze {
  const positions: Record<string, [number, number]> = {
    Arad: [0.06, 0.32],
    Zerind: [0.1, 0.18],
    Oradea: [0.18, 0.08],
    Sibiu: [0.28, 0.38],
    Timisoara: [0.06, 0.55],
    Lugoj: [0.18, 0.65],
    Mehadia: [0.2, 0.75],
    Drobeta: [0.22, 0.86],
    Craiova: [0.4, 0.86],
    'Rimnicu Vilcea': [0.36, 0.5],
    Fagaras: [0.5, 0.4],
    Pitesti: [0.5, 0.62],
    Bucharest: [0.7, 0.72],
    Giurgiu: [0.72, 0.88],
    Urziceni: [0.82, 0.66],
    Hirsova: [0.94, 0.6],
    Eforie: [0.97, 0.78],
    Vaslui: [0.86, 0.32],
    Iasi: [0.78, 0.18],
    Neamt: [0.68, 0.1],
  };

  const nodes: GraphNode[] = Object.entries(positions).map(([id, [x, y]]) => ({
    id,
    label: id,
    x,
    y,
  }));

  // Edges with classic Romania-map costs (km, scaled down to readable ints).
  const rawEdges: [string, string, number][] = [
    ['Arad', 'Zerind', 75],
    ['Arad', 'Sibiu', 140],
    ['Arad', 'Timisoara', 118],
    ['Zerind', 'Oradea', 71],
    ['Oradea', 'Sibiu', 151],
    ['Timisoara', 'Lugoj', 111],
    ['Lugoj', 'Mehadia', 70],
    ['Mehadia', 'Drobeta', 75],
    ['Drobeta', 'Craiova', 120],
    ['Craiova', 'Rimnicu Vilcea', 146],
    ['Craiova', 'Pitesti', 138],
    ['Rimnicu Vilcea', 'Sibiu', 80],
    ['Rimnicu Vilcea', 'Pitesti', 97],
    ['Sibiu', 'Fagaras', 99],
    ['Fagaras', 'Bucharest', 211],
    ['Pitesti', 'Bucharest', 101],
    ['Bucharest', 'Giurgiu', 90],
    ['Bucharest', 'Urziceni', 85],
    ['Urziceni', 'Hirsova', 98],
    ['Urziceni', 'Vaslui', 142],
    ['Hirsova', 'Eforie', 86],
    ['Vaslui', 'Iasi', 92],
    ['Iasi', 'Neamt', 87],
  ];

  const edges: GraphEdge[] = rawEdges.map(([from, to, cost]) => ({ from, to, cost }));
  return { nodes, edges, startId: 'Arad', goalId: 'Bucharest' };
}

export const GRAPH_PRESETS = {
  small: () => generateGraphMaze(8, { connectivity: 3 }),
  medium: () => generateGraphMaze(15, { connectivity: 3 }),
  large: () => generateGraphMaze(24, { connectivity: 3 }),
  romania: () => romaniaMap(),
} as const;

export type GraphPresetKey = keyof typeof GRAPH_PRESETS;
