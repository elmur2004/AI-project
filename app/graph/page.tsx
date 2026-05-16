'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GraphCanvas from '@/components/GraphCanvas';
import CodeBlock from '@/components/CodeBlock';
import { GRAPH_PRESETS, generateGraphMaze, type GraphPresetKey } from '@/lib/graph/generator';
import { GRAPH_SEARCH } from '@/lib/graph/search';
import {
  GRAPH_ALGORITHMS,
  type GraphAlgorithmId,
  type GraphMaze,
  type GraphSearchResult,
} from '@/lib/graph/types';
import { formatTime, sleep } from '@/lib/utils/helpers';

type Speed = 'slow' | 'medium' | 'fast' | 'instant';
const SPEED_DELAY: Record<Speed, number> = {
  slow: 200,
  medium: 60,
  fast: 15,
  instant: 0,
};

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphMaze>(() => GRAPH_PRESETS.medium());
  const [algorithm, setAlgorithm] = useState<GraphAlgorithmId>('dijkstra');
  const [size, setSize] = useState(15);
  const [speed, setSpeed] = useState<Speed>('fast');
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  const [result, setResult] = useState<GraphSearchResult | null>(null);
  const [explorationProgress, setExplorationProgress] = useState(1);
  const [comparison, setComparison] = useState<GraphSearchResult[] | null>(null);

  const meta = GRAPH_ALGORITHMS[algorithm];

  const onGenerate = useCallback(() => {
    setGraph(generateGraphMaze(size, { connectivity: 3 }));
    setResult(null);
    setComparison(null);
  }, [size]);

  const onPreset = useCallback((key: GraphPresetKey) => {
    setGraph(GRAPH_PRESETS[key]());
    setResult(null);
    setComparison(null);
  }, []);

  const animate = useCallback(
    async (res: GraphSearchResult) => {
      const delay = SPEED_DELAY[speed];
      setExplorationProgress(0);
      if (delay > 0) {
        const total = res.explorationOrder.length;
        const step = Math.max(1, Math.floor(total / 60));
        for (let i = 0; i <= total; i += step) {
          if (stopRef.current) break;
          setExplorationProgress(i / Math.max(1, total));
          await sleep(delay);
        }
      }
      setExplorationProgress(1);
    },
    [speed]
  );

  const onRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    stopRef.current = false;
    setComparison(null);
    try {
      const res = GRAPH_SEARCH[algorithm](graph);
      setResult(res);
      await animate(res);
    } finally {
      setIsRunning(false);
      stopRef.current = false;
    }
  }, [algorithm, graph, isRunning, animate]);

  const onStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const onCompareAll = useCallback(() => {
    if (isRunning) return;
    const out: GraphSearchResult[] = (
      Object.keys(GRAPH_ALGORITHMS) as GraphAlgorithmId[]
    ).map((id) => GRAPH_SEARCH[id](graph));
    setComparison(out);
    setResult(null);
  }, [graph, isRunning]);

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">Graph Mazes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Weighted-graph mazes with explicit edge costs. BFS counts edges; Dijkstra
            and A* minimize total cost; DFS finds <i>a</i> path, not the cheapest.
            Path cost is computed and shown for each run.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          {/* Graph + result */}
          <div className="space-y-4">
            <div className="card p-4">
              <GraphCanvas
                graph={graph}
                path={result?.path}
                pathColor={meta.color}
                explorationOrder={result?.explorationOrder}
                explorationProgress={explorationProgress}
                onHoverNode={setHoverNode}
                height={520}
              />
              <div className="mt-2 text-xs font-mono text-gray-500 flex justify-between">
                <span>
                  Nodes: {graph.nodes.length} · Edges: {graph.edges.length} · Start:{' '}
                  <span className="text-start">{graph.startId}</span> · Goal:{' '}
                  <span className="text-goal">{graph.goalId}</span>
                </span>
                {hoverNode && <span>hover: {hoverNode}</span>}
              </div>
            </div>

            {result && (
              <div className="card p-4 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-gray-500">
                  Result — {GRAPH_ALGORITHMS[result.algorithm].name}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Stat
                    label="Found"
                    value={result.found ? 'Yes' : 'No'}
                    accent={result.found ? 'text-start' : 'text-goal'}
                  />
                  <Stat
                    label="Path Cost"
                    value={result.found ? result.pathCost : '—'}
                  />
                  <Stat label="Path Length" value={result.path.length} />
                  <Stat label="States Explored" value={result.nodesExplored} />
                </div>
                {result.found && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                      Path
                    </div>
                    <div className="text-xs font-mono text-gray-300 leading-relaxed break-words">
                      {result.path.map((id, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-gray-600"> → </span>}
                          <span style={{ color: meta.color }}>{id}</span>
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Total cost ={' '}
                      <span className="font-mono text-gray-200">{result.pathCost}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {comparison && (
              <div className="card p-4">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                  Comparison on this graph
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 border-b border-white/5">
                      <tr>
                        <th className="text-left p-2 font-medium">Algorithm</th>
                        <th className="text-right p-2 font-medium">Found</th>
                        <th className="text-right p-2 font-medium">Path Cost</th>
                        <th className="text-right p-2 font-medium">Path Length</th>
                        <th className="text-right p-2 font-medium">States Explored</th>
                        <th className="text-right p-2 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((r) => {
                        const m = GRAPH_ALGORITHMS[r.algorithm];
                        const validCosts = comparison
                          .filter((x) => x.found)
                          .map((x) => x.pathCost);
                        const bestCost = validCosts.length ? Math.min(...validCosts) : 0;
                        const optimal = r.found && r.pathCost === bestCost;
                        return (
                          <tr
                            key={r.algorithm}
                            className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                          >
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ background: m.color }}
                                />
                                <span className="text-gray-200">{m.name}</span>
                              </div>
                            </td>
                            <td className="text-right p-2">
                              {r.found ? (
                                <span className="text-start">Yes</span>
                              ) : (
                                <span className="text-goal">No</span>
                              )}
                            </td>
                            <td
                              className={`text-right p-2 font-mono ${
                                optimal ? 'text-start font-semibold' : 'text-gray-200'
                              }`}
                            >
                              {r.found ? r.pathCost : '—'}
                            </td>
                            <td className="text-right p-2 font-mono">
                              {r.found ? r.path.length : '—'}
                            </td>
                            <td className="text-right p-2 font-mono">{r.nodesExplored}</td>
                            <td className="text-right p-2 font-mono">
                              {formatTime(r.executionTime)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <b>Note:</b> on weighted graphs, BFS finds the fewest-edges path
                  (which may have a higher cost than Dijkstra's lowest-cost path); DFS
                  finds a valid path but offers no optimality guarantee.
                </p>
              </div>
            )}

            <div className="card p-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                Algorithm: {meta.name}
              </h3>
              <p className="text-sm text-gray-400 mb-3">{meta.description}</p>
              <CodeBlock
                title="Pseudocode"
                code={pseudocode(algorithm)}
                language="pseudocode"
              />
            </div>
          </div>

          {/* Controls */}
          <aside className="space-y-4">
            <section className="card p-4 space-y-3">
              <h3 className="text-sm uppercase tracking-wider text-gray-500">
                Graph Settings
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[8, 12, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSize(n)}
                    disabled={isRunning}
                    className={`px-2 py-1.5 rounded-md text-xs font-mono transition ${
                      size === n
                        ? 'bg-start text-base'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={onGenerate}
                disabled={isRunning}
                className="btn btn-secondary w-full text-sm"
              >
                Generate Random Graph
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onPreset('small')}
                  disabled={isRunning}
                  className="btn btn-secondary text-xs"
                >
                  Small
                </button>
                <button
                  onClick={() => onPreset('medium')}
                  disabled={isRunning}
                  className="btn btn-secondary text-xs"
                >
                  Medium
                </button>
                <button
                  onClick={() => onPreset('large')}
                  disabled={isRunning}
                  className="btn btn-secondary text-xs"
                >
                  Large
                </button>
                <button
                  onClick={() => onPreset('romania')}
                  disabled={isRunning}
                  className="btn btn-secondary text-xs"
                  title="The classic Russell & Norvig Romania map"
                >
                  Romania
                </button>
              </div>
            </section>

            <section className="card p-4 space-y-3">
              <h3 className="text-sm uppercase tracking-wider text-gray-500">
                Algorithm
              </h3>
              <div className="space-y-1.5">
                {(Object.keys(GRAPH_ALGORITHMS) as GraphAlgorithmId[]).map((id) => {
                  const m = GRAPH_ALGORITHMS[id];
                  const active = algorithm === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAlgorithm(id)}
                      disabled={isRunning}
                      className={`w-full text-left p-2.5 rounded-md transition border ${
                        active
                          ? 'border-white/20 bg-white/5'
                          : 'border-transparent bg-white/[0.02] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: m.color,
                            boxShadow: active ? `0 0 8px ${m.color}` : undefined,
                          }}
                        />
                        <span className="text-sm font-medium text-gray-200">
                          {m.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 ml-4">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card p-4 space-y-3">
              <h3 className="text-sm uppercase tracking-wider text-gray-500">
                Animation Speed
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {(['slow', 'medium', 'fast', 'instant'] as Speed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-1.5 rounded-md text-xs capitalize transition ${
                      speed === s
                        ? 'bg-start text-base'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <div className="space-y-2">
              {isRunning ? (
                <button
                  onClick={onStop}
                  className="btn w-full bg-goal hover:bg-goal/90 text-base font-semibold"
                >
                  STOP
                </button>
              ) : (
                <button
                  onClick={onRun}
                  className="btn btn-primary w-full font-semibold text-base py-3"
                >
                  ▶ RUN {meta.shortName}
                </button>
              )}
              <button
                onClick={onCompareAll}
                disabled={isRunning}
                className="btn btn-secondary w-full text-sm"
              >
                Compare All on This Graph
              </button>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`font-mono ${accent ?? 'text-gray-100'}`}>{value}</div>
    </div>
  );
}

function pseudocode(id: GraphAlgorithmId): string {
  switch (id) {
    case 'bfs':
      return `function bfsGraph(G, start, goal):
  visited = {start}
  parent[start] = null
  queue = [start]              # FIFO
  while queue not empty:
    u = queue.dequeue()
    if u == goal: return reconstruct(parent, u)
    for (v, w) of neighbors(u):    # w = edge weight (ignored by BFS)
      if v not in visited:
        visited.add(v)
        parent[v] = u
        queue.enqueue(v)
  return failure`;
    case 'dfs':
      return `function dfsGraph(G, start, goal):
  visited = {start}
  parent[start] = null
  stack = [start]              # LIFO
  while stack not empty:
    u = stack.pop()
    if u == goal: return reconstruct(parent, u)
    for (v, w) of neighbors(u):
      if v not in visited:
        visited.add(v)
        parent[v] = u
        stack.push(v)
  return failure`;
    case 'dijkstra':
      return `function dijkstraGraph(G, start, goal):
  dist[start] = 0
  pq = MinHeap((0, start))
  while pq not empty:
    (d, u) = pq.pop()
    if u in closed: continue
    closed.add(u)
    if u == goal: return reconstruct(parent, u)
    for (v, w) of neighbors(u):
      if d + w < dist[v]:
        dist[v] = d + w
        parent[v] = u
        pq.push((d + w, v))
  return failure`;
    case 'astar':
      return `function aStarGraph(G, start, goal):
  g[start] = 0
  pq = MinHeap((h(start), start))   # h = Euclidean distance
  while pq not empty:
    (f, u) = pq.pop()
    if u in closed: continue
    closed.add(u)
    if u == goal: return reconstruct(parent, u)
    for (v, w) of neighbors(u):
      tentativeG = g[u] + w
      if tentativeG < g[v]:
        g[v] = tentativeG
        parent[v] = u
        pq.push((tentativeG + h(v), v))
  return failure`;
  }
}
