'use client';

import type { AlgorithmId } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import CodeBlock from './CodeBlock';

const PSEUDO: Record<AlgorithmId, string> = {
  astar: `function aStar(start, goal):
  open = MinHeap()
  open.push(start, f = h(start))
  gScore[start] = 0
  while open is not empty:
    current = open.pop()
    if current == goal: return reconstruct(current)
    for neighbor of current:
      tentativeG = gScore[current] + 1
      if tentativeG < gScore[neighbor]:
        cameFrom[neighbor] = current
        gScore[neighbor] = tentativeG
        f = tentativeG + h(neighbor)   # Manhattan
        open.push(neighbor, f)
  return failure`,
  dijkstra: `function dijkstra(start, goal):
  dist[start] = 0
  open = MinHeap((0, start))
  while open is not empty:
    (d, u) = open.pop()
    if u == goal: return reconstruct(u)
    for v of neighbors(u):
      if d + 1 < dist[v]:
        dist[v] = d + 1
        prev[v] = u
        open.push((d+1, v))
  return failure`,
  qlearning: `initialize Q[s, a] = 0
for episode = 1..N:
  s = env.reset()
  while not done:
    a = epsilon_greedy(Q, s)
    s', r, done = env.step(a)
    Q[s, a] = Q[s, a] + alpha * (
        r + gamma * max_a' Q[s', a'] - Q[s, a]
    )
    s = s'
  decay epsilon`,
  dqn: `initialize Q-network theta, target theta'
replay buffer D
for episode = 1..N:
  s = env.reset()
  while not done:
    a = epsilon_greedy(Q_theta, s)
    s', r, done = env.step(a)
    store (s, a, r, s', done) in D
    sample minibatch from D
    target = r + gamma * max_a' Q_theta'(s', a')   # 0 if done
    train Q_theta to predict target for action a
    s = s'
  every K episodes: theta' <- theta`,
};

interface Props {
  algorithm: AlgorithmId;
}

export default function AlgorithmPanel({ algorithm }: Props) {
  const meta = ALGORITHMS[algorithm];
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}` }}
        />
        <h3 className="font-semibold text-gray-100">{meta.name}</h3>
        <span className="ml-auto text-xs uppercase tracking-wider text-gray-500">
          {meta.type === 'rl' ? 'Reinforcement Learning' : 'Search'}
        </span>
      </div>
      <p className="text-sm text-gray-400">{meta.description}</p>
      <CodeBlock code={PSEUDO[algorithm]} title="Pseudocode" />
    </div>
  );
}
