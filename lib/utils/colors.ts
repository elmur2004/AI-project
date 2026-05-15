export const COLORS = {
  base: '#0a0a0f',
  card: '#12121a',
  wall: '#1a1a2e',
  path: '#16213e',
  start: '#00b894',
  goal: '#e17055',
  agent: '#fbbf24',
  trail: 'rgba(251, 191, 36, 0.35)',
  exploration: 'rgba(99, 102, 241, 0.25)',
  algo: {
    qlearning: '#3b82f6',
    dqn: '#a855f7',
    astar: '#f59e0b',
    dijkstra: '#14b8a6',
  },
} as const;

export type AlgoColorKey = keyof typeof COLORS.algo;
