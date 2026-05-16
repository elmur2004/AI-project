export type Cell = [number, number]; // [row, col]

export const ACTIONS = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
} as const;

export type Action = 0 | 1 | 2 | 3;

export const ACTION_DELTAS: Record<Action, Cell> = {
  0: [-1, 0],
  1: [1, 0],
  2: [0, -1],
  3: [0, 1],
};

export const ACTION_NAMES = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;

export const REWARDS = {
  GOAL: 100,
  WALL_HIT: -10,
  STEP: -1,
  REVISIT: -3,
} as const;

export interface MazeState {
  position: Cell;
  visited: Set<string>;
  totalReward: number;
  steps: number;
}

export interface StepResult {
  nextState: MazeState;
  reward: number;
  done: boolean;
  info: {
    hitWall: boolean;
    revisit: boolean;
    reachedGoal: boolean;
  };
}

export interface SearchResult {
  path: Cell[];
  nodesExplored: number;
  executionTime: number;
  explorationOrder: Cell[];
  found: boolean;
  // Parent of each discovered cell, keyed by "r,c". null for the root (start).
  // Used to draw the search tree built by BFS / DFS / A* / Dijkstra.
  parents?: Map<string, Cell | null>;
  // Total cost of the path. For grid mazes with unit edges, equals path.length - 1.
  pathCost?: number;
}

export interface EpisodeStat {
  episode: number;
  reward: number;
  steps: number;
  epsilon?: number;
}

export interface TrainingResult {
  episodeStats: EpisodeStat[];
  finalPath: Cell[];
  executionTime: number;
  totalEpisodes: number;
  bestPathLength: number;
  bestReward: number;
}

export type AlgorithmId = 'astar' | 'dijkstra' | 'bfs' | 'dfs' | 'qlearning' | 'dqn';

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  shortName: string;
  description: string;
  color: string;
  type: 'search' | 'rl';
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmMeta> = {
  astar: {
    id: 'astar',
    name: 'A* Search',
    shortName: 'A*',
    description: 'Optimal pathfinding with Manhattan-distance heuristic.',
    color: '#f59e0b',
    type: 'search',
  },
  dijkstra: {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    shortName: 'Dijkstra',
    description: 'Guaranteed shortest path; explores uniformly without heuristic.',
    color: '#14b8a6',
    type: 'search',
  },
  bfs: {
    id: 'bfs',
    name: 'Breadth-First Search',
    shortName: 'BFS',
    description: 'Layer-by-layer exploration; optimal on unweighted graphs.',
    color: '#ec4899',
    type: 'search',
  },
  dfs: {
    id: 'dfs',
    name: 'Depth-First Search',
    shortName: 'DFS',
    description: 'Goes deep before backtracking; finds a path, not always shortest.',
    color: '#84cc16',
    type: 'search',
  },
  qlearning: {
    id: 'qlearning',
    name: 'Q-Learning',
    shortName: 'Q-Learn',
    description: 'Tabular RL agent that learns optimal actions by trial and error.',
    color: '#3b82f6',
    type: 'rl',
  },
  dqn: {
    id: 'dqn',
    name: 'Deep Q-Network (DQN)',
    shortName: 'DQN',
    description: 'Neural-network-based RL agent with experience replay.',
    color: '#a855f7',
    type: 'rl',
  },
};

export interface ComparisonResult {
  algorithm: AlgorithmId;
  pathLength: number;
  executionTime: number;
  nodesExplored: number;
  pathFound: boolean;
  path: Cell[];
}
