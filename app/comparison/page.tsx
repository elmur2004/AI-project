'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MazeCanvas from '@/components/MazeCanvas';
import ComparisonChart from '@/components/ComparisonChart';
import ComparisonTable from '@/components/ComparisonTable';
import { generateMaze } from '@/lib/maze/generator';
import { MazeEnvironment } from '@/lib/maze/environment';
import { astar } from '@/lib/algorithms/astar';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { QLearningAgent } from '@/lib/algorithms/qlearning';
import { DQNAgent } from '@/lib/algorithms/dqn';
import type { AlgorithmId, Cell, ComparisonResult } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import { downloadJSON, formatTime } from '@/lib/utils/helpers';

interface Payload {
  maze: number[][];
  start: Cell;
  goal: Cell;
  rlParams: {
    episodes: number;
    learningRate: number;
    discountFactor: number;
    epsilon: number;
  };
}

const DEFAULT_RL = {
  episodes: 500,
  learningRate: 0.1,
  discountFactor: 0.95,
  epsilon: 1.0,
};

export default function ComparisonPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [visibleAlgos, setVisibleAlgos] = useState<Record<AlgorithmId, boolean>>({
    astar: true,
    dijkstra: true,
    qlearning: true,
    dqn: true,
  });

  // Load payload from sessionStorage or generate fresh
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let p: Payload | null = null;
    try {
      const raw = sessionStorage.getItem('maze-payload');
      if (raw) p = JSON.parse(raw);
    } catch {
      p = null;
    }
    if (!p) {
      const m = generateMaze(15, 15);
      p = {
        maze: m,
        start: [0, 0],
        goal: [m.length - 1, m[0].length - 1],
        rlParams: DEFAULT_RL,
      };
    }
    setPayload(p);
  }, []);

  const runComparison = useCallback(async () => {
    if (!payload) return;
    setRunning(true);
    setResults([]);
    const out: ComparisonResult[] = [];

    setProgress('Running A*...');
    await Promise.resolve();
    {
      const r = astar(payload.maze, payload.start, payload.goal);
      out.push({
        algorithm: 'astar',
        pathLength: r.path.length,
        executionTime: r.executionTime,
        nodesExplored: r.nodesExplored,
        pathFound: r.found,
        path: r.path,
      });
    }
    setResults(out.slice());

    setProgress('Running Dijkstra...');
    await Promise.resolve();
    {
      const r = dijkstra(payload.maze, payload.start, payload.goal);
      out.push({
        algorithm: 'dijkstra',
        pathLength: r.path.length,
        executionTime: r.executionTime,
        nodesExplored: r.nodesExplored,
        pathFound: r.found,
        path: r.path,
      });
    }
    setResults(out.slice());

    setProgress('Training Q-Learning...');
    await new Promise((res) => setTimeout(res, 0));
    {
      const env = new MazeEnvironment(payload.maze, payload.start, payload.goal);
      const agent = new QLearningAgent({
        learningRate: payload.rlParams.learningRate,
        discountFactor: payload.rlParams.discountFactor,
        epsilon: payload.rlParams.epsilon,
      });
      let visited = 0;
      const seen = new Set<string>();
      const result = await agent.train(env, payload.rlParams.episodes, (_e, _r, _s, path) => {
        for (const [r, c] of path) {
          const k = `${r},${c}`;
          if (!seen.has(k)) {
            seen.add(k);
            visited++;
          }
        }
      });
      const reached =
        result.finalPath.length > 0 &&
        result.finalPath[result.finalPath.length - 1][0] === payload.goal[0] &&
        result.finalPath[result.finalPath.length - 1][1] === payload.goal[1];
      out.push({
        algorithm: 'qlearning',
        pathLength: reached ? result.finalPath.length : 0,
        executionTime: result.executionTime,
        nodesExplored: visited,
        pathFound: reached,
        path: result.finalPath,
      });
    }
    setResults(out.slice());

    setProgress('Training DQN...');
    await new Promise((res) => setTimeout(res, 0));
    {
      const env = new MazeEnvironment(payload.maze, payload.start, payload.goal);
      const agent = new DQNAgent(payload.maze.length, payload.maze[0].length, {
        learningRate: payload.rlParams.learningRate,
        discountFactor: payload.rlParams.discountFactor,
        epsilon: payload.rlParams.epsilon,
      });
      // DQN is heavier — cap episodes for the comparison run so it stays interactive
      const eps = Math.min(payload.rlParams.episodes, 300);
      let visited = 0;
      const seen = new Set<string>();
      const result = await agent.train(env, eps, (_e, _r, _s, path) => {
        for (const [r, c] of path) {
          const k = `${r},${c}`;
          if (!seen.has(k)) {
            seen.add(k);
            visited++;
          }
        }
      });
      const reached =
        result.finalPath.length > 0 &&
        result.finalPath[result.finalPath.length - 1][0] === payload.goal[0] &&
        result.finalPath[result.finalPath.length - 1][1] === payload.goal[1];
      out.push({
        algorithm: 'dqn',
        pathLength: reached ? result.finalPath.length : 0,
        executionTime: result.executionTime,
        nodesExplored: visited,
        pathFound: reached,
        path: result.finalPath,
      });
    }
    setResults(out.slice());
    setProgress('Done.');
    setRunning(false);
  }, [payload]);

  // Auto-run when payload is loaded for the first time
  useEffect(() => {
    if (payload && results.length === 0 && !running) {
      runComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const overlays = useMemo(() => {
    if (!payload) return [];
    return results
      .filter((r) => visibleAlgos[r.algorithm] && r.pathFound)
      .map((r) => ({
        cells: r.path,
        color: ALGORITHMS[r.algorithm].color,
      }));
  }, [results, visibleAlgos, payload]);

  const analysis = useMemo(() => buildAnalysis(results), [results]);

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">Algorithm Comparison</h1>
            <p className="text-sm text-gray-400 mt-1">
              All four algorithms run on the same maze. Paths are overlaid below — toggle
              them on/off and inspect the metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runComparison}
              disabled={running || !payload}
              className="btn btn-secondary text-sm"
            >
              {running ? 'Running...' : 'Re-run'}
            </button>
            <button
              onClick={() => downloadJSON(results, 'maze-comparison.json')}
              disabled={results.length === 0}
              className="btn btn-secondary text-sm"
            >
              Export JSON
            </button>
          </div>
        </header>

        {!payload ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(Object.keys(ALGORITHMS) as AlgorithmId[]).map((id) => {
                    const meta = ALGORITHMS[id];
                    const on = visibleAlgos[id];
                    return (
                      <button
                        key={id}
                        onClick={() =>
                          setVisibleAlgos((v) => ({ ...v, [id]: !v[id] }))
                        }
                        className="px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 transition"
                        style={{
                          background: on ? `${meta.color}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${on ? meta.color : 'transparent'}`,
                          color: on ? meta.color : '#9ca3af',
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: meta.color, opacity: on ? 1 : 0.4 }}
                        />
                        {meta.shortName}
                      </button>
                    );
                  })}
                </div>
                <MazeCanvas
                  maze={payload.maze}
                  start={payload.start}
                  goal={payload.goal}
                  overlays={overlays}
                />
              </div>

              {running && (
                <div className="card p-4 text-sm text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-start animate-pulse mr-2" />
                  {progress}
                </div>
              )}

              {results.length > 0 && (
                <>
                  <ComparisonTable results={results} />
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="card p-4">
                      <ComparisonChart results={results} metric="pathLength" />
                    </div>
                    <div className="card p-4">
                      <ComparisonChart results={results} metric="executionTime" />
                    </div>
                    <div className="card p-4">
                      <ComparisonChart results={results} metric="nodesExplored" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <aside className="space-y-4">
              <div className="card p-4">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                  Analysis
                </h3>
                {results.length === 0 ? (
                  <p className="text-sm text-gray-400">Results will appear here.</p>
                ) : (
                  <div className="space-y-3 text-sm text-gray-300">
                    {analysis.summary.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-3">
                  Quick Numbers
                </h3>
                <ul className="space-y-2 text-sm">
                  {results.map((r) => {
                    const meta = ALGORITHMS[r.algorithm];
                    return (
                      <li key={r.algorithm} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: meta.color }}
                        />
                        <span className="text-gray-300 flex-1">{meta.shortName}</span>
                        <span className="font-mono text-gray-400 text-xs">
                          {r.pathFound ? `${r.pathLength} steps` : 'no path'} ·{' '}
                          {formatTime(r.executionTime)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function buildAnalysis(results: ComparisonResult[]): { summary: string[] } {
  if (results.length === 0) return { summary: [] };
  const valid = results.filter((r) => r.pathFound);
  if (valid.length === 0) {
    return { summary: ['No algorithm found a path on this maze.'] };
  }
  const shortest = valid.reduce((a, b) => (a.pathLength <= b.pathLength ? a : b));
  const fastest = valid.reduce((a, b) => (a.executionTime <= b.executionTime ? a : b));
  const leanest = valid.reduce((a, b) => (a.nodesExplored <= b.nodesExplored ? a : b));

  const lines: string[] = [];
  lines.push(
    `Shortest path: ${ALGORITHMS[shortest.algorithm].name} (${shortest.pathLength} steps).`
  );
  lines.push(
    `Fastest execution: ${ALGORITHMS[fastest.algorithm].name} (${formatTime(fastest.executionTime)}).`
  );
  lines.push(
    `Fewest states explored: ${ALGORITHMS[leanest.algorithm].name} (${leanest.nodesExplored}).`
  );

  // Insight about A* vs Dijkstra
  const astarRes = results.find((r) => r.algorithm === 'astar');
  const dijRes = results.find((r) => r.algorithm === 'dijkstra');
  if (astarRes && dijRes && astarRes.pathFound && dijRes.pathFound) {
    if (astarRes.pathLength === dijRes.pathLength) {
      lines.push(
        `A* and Dijkstra both produced optimal paths; A* expanded ${astarRes.nodesExplored} vs Dijkstra's ${dijRes.nodesExplored}, showing the heuristic's pruning effect.`
      );
    }
  }

  const ql = results.find((r) => r.algorithm === 'qlearning');
  const dqn = results.find((r) => r.algorithm === 'dqn');
  if (ql && ql.pathFound) {
    lines.push(
      `Q-Learning converged to a usable policy in ${formatTime(ql.executionTime)}. It learns without knowing the maze — but the trade-off is wall-clock time spent on episodes.`
    );
  } else if (ql) {
    lines.push(
      'Q-Learning did not converge in the given budget. Try more episodes or a higher learning rate.'
    );
  }
  if (dqn && dqn.pathFound) {
    lines.push(
      `DQN, using a from-scratch JavaScript neural network, generalized to a working policy. On small grids the tabular Q-Learner is usually sample-efficient enough that DQN is overkill.`
    );
  } else if (dqn) {
    lines.push(
      'DQN did not converge in the given budget. Neural-network RL needs more episodes; consider increasing the count.'
    );
  }

  return { summary: lines };
}
