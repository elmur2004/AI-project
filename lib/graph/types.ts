export interface GraphNode {
  id: string;
  label?: string;
  x: number; // 0..1 normalized canvas coords
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  cost: number;
}

export interface GraphMaze {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startId: string;
  goalId: string;
}

export interface GraphSearchResult {
  path: string[]; // sequence of node ids
  pathCost: number; // sum of edge costs
  nodesExplored: number;
  executionTime: number;
  explorationOrder: string[];
  parents: Map<string, string | null>; // node id -> parent id
  found: boolean;
  algorithm: GraphAlgorithmId;
}

export type GraphAlgorithmId = 'bfs' | 'dfs' | 'dijkstra' | 'astar';

export interface GraphAlgorithmMeta {
  id: GraphAlgorithmId;
  name: string;
  shortName: string;
  description: string;
  color: string;
}

export const GRAPH_ALGORITHMS: Record<GraphAlgorithmId, GraphAlgorithmMeta> = {
  bfs: {
    id: 'bfs',
    name: 'Breadth-First Search',
    shortName: 'BFS',
    description: 'Fewest *edges* to the goal — ignores edge cost.',
    color: '#ec4899',
  },
  dfs: {
    id: 'dfs',
    name: 'Depth-First Search',
    shortName: 'DFS',
    description: 'Follows one branch deeply; finds a path, not the cheapest.',
    color: '#84cc16',
  },
  dijkstra: {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    shortName: 'Dijkstra',
    description: 'Cheapest-cost path; uses edge weights, no heuristic.',
    color: '#14b8a6',
  },
  astar: {
    id: 'astar',
    name: 'A* Search',
    shortName: 'A*',
    description: 'Cheapest-cost path guided by a Euclidean-distance heuristic.',
    color: '#f59e0b',
  },
};
