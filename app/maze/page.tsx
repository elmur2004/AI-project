'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MazeCanvas from '@/components/MazeCanvas';
import MazeControls, { type RLParams, type Speed } from '@/components/MazeControls';
import AlgorithmPanel from '@/components/AlgorithmPanel';
import LearningCurveChart from '@/components/LearningCurveChart';
import StepsChart from '@/components/StepsChart';
import HeatmapCanvas from '@/components/HeatmapCanvas';
import ProgressBar from '@/components/ProgressBar';
import { generateMaze, emptyMaze } from '@/lib/maze/generator';
import { PRESETS } from '@/lib/maze/presets';
import { MazeEnvironment } from '@/lib/maze/environment';
import { astar } from '@/lib/algorithms/astar';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { QLearningAgent } from '@/lib/algorithms/qlearning';
import { DQNAgent } from '@/lib/algorithms/dqn';
import type {
  AlgorithmId,
  Cell,
  EpisodeStat,
  SearchResult,
} from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import { COLORS } from '@/lib/utils/colors';
import { formatTime, sleep } from '@/lib/utils/helpers';

const SPEED_DELAY: Record<Speed, number> = {
  slow: 100,
  medium: 30,
  fast: 5,
  instant: 0,
};

export default function MazePage() {
  const [size, setSize] = useState(15);
  const [maze, setMaze] = useState<number[][]>(() => generateMaze(15, 15));
  const [editMode, setEditMode] = useState(false);
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('astar');
  const [rlParams, setRLParams] = useState<RLParams>({
    episodes: 500,
    learningRate: 0.1,
    discountFactor: 0.95,
    epsilon: 1.0,
  });
  const [speed, setSpeed] = useState<Speed>('fast');

  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);

  const [explorationOrder, setExplorationOrder] = useState<Cell[]>([]);
  const [explorationProgress, setExplorationProgress] = useState(0);
  const [agentPosition, setAgentPosition] = useState<Cell | null>(null);
  const [trail, setTrail] = useState<Cell[]>([]);
  const [solutionPath, setSolutionPath] = useState<Cell[]>([]);
  const [pathColor, setPathColor] = useState<string>(COLORS.start);

  const [stats, setStats] = useState<{
    episode?: number;
    totalEpisodes?: number;
    reward?: number;
    steps?: number;
    bestPathLength?: number;
    timeElapsed?: number;
    nodesExplored?: number;
  }>({});

  const [episodeStats, setEpisodeStats] = useState<EpisodeStat[]>([]);
  const [qValueGrid, setQValueGrid] = useState<number[][] | null>(null);
  const [visitGrid, setVisitGrid] = useState<number[][] | null>(null);

  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [hoverQ, setHoverQ] = useState<number[] | null>(null);

  const start: Cell = useMemo(() => [0, 0], []);
  const goal: Cell = useMemo(() => [size - 1, size - 1], [size]);

  const resetVisuals = useCallback(() => {
    setExplorationOrder([]);
    setExplorationProgress(0);
    setAgentPosition(null);
    setTrail([]);
    setSolutionPath([]);
    setStats({});
    setEpisodeStats([]);
    setQValueGrid(null);
    setVisitGrid(null);
    setHoverQ(null);
  }, []);

  const onSizeChange = useCallback(
    (s: number) => {
      setSize(s);
      setMaze(generateMaze(s, s));
      resetVisuals();
    },
    [resetVisuals]
  );

  const onGenerate = useCallback(() => {
    setMaze(generateMaze(size, size));
    resetVisuals();
  }, [size, resetVisuals]);

  const onPreset = useCallback(
    (key: 'easy' | 'medium' | 'hard') => {
      const newMaze = PRESETS[key]();
      setMaze(newMaze);
      setSize(newMaze.length);
      resetVisuals();
    },
    [resetVisuals]
  );

  const onClear = useCallback(() => {
    setMaze(emptyMaze(size, size));
    resetVisuals();
  }, [size, resetVisuals]);

  const onToggleWall = useCallback(
    (r: number, c: number) => {
      // Don't allow blocking start or goal
      if ((r === start[0] && c === start[1]) || (r === goal[0] && c === goal[1])) return;
      setMaze((m) => {
        const next = m.map((row) => row.slice());
        next[r][c] = next[r][c] === 1 ? 0 : 1;
        return next;
      });
      resetVisuals();
    },
    [start, goal, resetVisuals]
  );

  // Animate a search result on the canvas.
  const animateSearch = useCallback(
    async (result: SearchResult, color: string) => {
      const delay = SPEED_DELAY[speed];
      setPathColor(color);
      setExplorationOrder(result.explorationOrder);

      if (delay > 0) {
        const total = result.explorationOrder.length;
        const chunk = Math.max(1, Math.floor(total / 80));
        for (let i = 0; i <= total; i += chunk) {
          if (stopRef.current) break;
          setExplorationProgress(i / total);
          await sleep(delay);
        }
      }
      setExplorationProgress(1);
      // Draw path with a small reveal animation
      if (delay > 0 && result.path.length > 0) {
        for (let i = 1; i <= result.path.length; i++) {
          if (stopRef.current) break;
          setSolutionPath(result.path.slice(0, i));
          await sleep(delay);
        }
      } else {
        setSolutionPath(result.path);
      }
    },
    [speed]
  );

  // Animate an agent following a learned path.
  const animateAgentPath = useCallback(
    async (path: Cell[], color: string) => {
      const delay = SPEED_DELAY[speed];
      setPathColor(color);
      setSolutionPath(path);
      if (delay > 0) {
        const t: Cell[] = [];
        for (let i = 0; i < path.length; i++) {
          if (stopRef.current) break;
          setAgentPosition(path[i]);
          t.push(path[i]);
          setTrail(t.slice());
          await sleep(delay);
        }
      } else {
        setAgentPosition(path[path.length - 1] ?? null);
        setTrail(path);
      }
    },
    [speed]
  );

  // Build visitation heatmap from episode paths.
  const buildVisitGrid = useCallback(
    (rows: number, cols: number) => {
      const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
      return grid;
    },
    []
  );

  // Run currently selected algorithm.
  const onRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    stopRef.current = false;
    resetVisuals();
    const meta = ALGORITHMS[algorithm];
    setPathColor(meta.color);

    try {
      if (algorithm === 'astar' || algorithm === 'dijkstra') {
        const fn = algorithm === 'astar' ? astar : dijkstra;
        const t0 = performance.now();
        const result = fn(maze, start, goal);
        setStats({
          timeElapsed: result.executionTime,
          nodesExplored: result.nodesExplored,
          bestPathLength: result.path.length,
        });
        await animateSearch(result, meta.color);
        // Animate agent walking the found path
        if (!stopRef.current && result.found) {
          await sleep(120);
          await animateAgentPath(result.path, meta.color);
        }
        setStats((s) => ({ ...s, timeElapsed: performance.now() - t0 }));
      } else {
        // RL training
        const env = new MazeEnvironment(maze, start, goal);
        const visitGrid = buildVisitGrid(maze.length, maze[0].length);
        setStats({ totalEpisodes: rlParams.episodes });

        const onEp = (
          episode: number,
          reward: number,
          steps: number,
          path: Cell[]
        ) => {
          if (stopRef.current) return;
          for (const [r, c] of path) {
            if (visitGrid[r] && visitGrid[r][c] !== undefined) visitGrid[r][c]++;
          }
          setStats((s) => ({
            ...s,
            episode,
            totalEpisodes: rlParams.episodes,
            reward,
            steps,
            bestPathLength:
              s.bestPathLength === undefined
                ? path.length
                : Math.min(s.bestPathLength, path[path.length - 1][0] === goal[0] && path[path.length - 1][1] === goal[1] ? path.length : s.bestPathLength),
          }));
          setEpisodeStats((prev) => [...prev, { episode, reward, steps }]);
        };

        let trainResult;
        if (algorithm === 'qlearning') {
          const agent = new QLearningAgent({
            learningRate: rlParams.learningRate,
            discountFactor: rlParams.discountFactor,
            epsilon: rlParams.epsilon,
          });
          trainResult = await agent.train(env, rlParams.episodes, onEp);
          if (!stopRef.current) {
            // Build Q-value heatmap (max Q per state)
            const qGrid: number[][] = Array.from({ length: maze.length }, () =>
              Array(maze[0].length).fill(0)
            );
            agent.qTable.forEach((q, key) => {
              const [r, c] = key.split(',').map(Number);
              if (qGrid[r] && qGrid[r][c] !== undefined) qGrid[r][c] = Math.max(...q);
            });
            setQValueGrid(qGrid);
            setVisitGrid(visitGrid);
          }
        } else {
          const agent = new DQNAgent(maze.length, maze[0].length, {
            learningRate: rlParams.learningRate,
            discountFactor: rlParams.discountFactor,
            epsilon: rlParams.epsilon,
          });
          trainResult = await agent.train(env, rlParams.episodes, onEp);
          if (!stopRef.current) {
            // Build Q-value heatmap from network
            const qGrid: number[][] = Array.from({ length: maze.length }, () =>
              Array(maze[0].length).fill(0)
            );
            for (let r = 0; r < maze.length; r++) {
              for (let c = 0; c < maze[0].length; c++) {
                if (maze[r][c] === 1) continue;
                const q = agent.network.forward([
                  r / Math.max(1, maze.length - 1),
                  c / Math.max(1, maze[0].length - 1),
                ]);
                qGrid[r][c] = Math.max(...q);
              }
            }
            setQValueGrid(qGrid);
            setVisitGrid(visitGrid);
          }
        }

        if (stopRef.current) return;
        setStats((s) => ({
          ...s,
          timeElapsed: trainResult.executionTime,
          bestPathLength: trainResult.bestPathLength,
        }));
        // Show learned path
        if (trainResult.finalPath.length > 0) {
          await sleep(200);
          await animateAgentPath(trainResult.finalPath, meta.color);
        }
      }
    } finally {
      setIsRunning(false);
      stopRef.current = false;
    }
  }, [
    isRunning,
    algorithm,
    maze,
    start,
    goal,
    rlParams,
    resetVisuals,
    animateSearch,
    animateAgentPath,
    buildVisitGrid,
  ]);

  const onStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  // Run all algorithms sequentially and store results in sessionStorage,
  // then navigate to /comparison.
  const onRunAll = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        'maze-payload',
        JSON.stringify({ maze, start, goal, rlParams })
      );
    } catch {
      // ignore quota errors
    }
    window.location.href = '/comparison';
  }, [maze, start, goal, rlParams]);

  // Hover -> show Q values for that cell if we have them (qlearning only really).
  useEffect(() => {
    if (!hoverCell || algorithm !== 'qlearning' || !qValueGrid) {
      setHoverQ(null);
      return;
    }
    // We only stored max Q above; for full hover we'd need raw qTable.
    // Surface the max value instead.
    const [r, c] = hoverCell;
    if (qValueGrid[r] && qValueGrid[r][c] !== undefined) {
      setHoverQ([qValueGrid[r][c]]);
    }
  }, [hoverCell, qValueGrid, algorithm]);

  const algoMeta = ALGORITHMS[algorithm];
  const progressFraction =
    stats.totalEpisodes && stats.episode
      ? stats.episode / stats.totalEpisodes
      : isRunning && stats.nodesExplored !== undefined
        ? 1
        : 0;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">Interactive Maze</h1>
          <p className="text-sm text-gray-400 mt-1">
            Pick an algorithm, hit Run, and watch it solve. Click cells in Edit Mode to
            draw your own walls.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          {/* Maze area */}
          <div className="space-y-4">
            <div className="card p-4">
              <MazeCanvas
                maze={maze}
                start={start}
                goal={goal}
                path={solutionPath.length > 1 ? solutionPath : undefined}
                pathColor={pathColor}
                explorationOrder={explorationOrder}
                explorationProgress={explorationProgress}
                agentPosition={agentPosition}
                trail={trail}
                editable={editMode}
                onToggleWall={onToggleWall}
                onHoverCell={setHoverCell}
              />
              {hoverCell && (
                <div className="mt-2 text-xs text-gray-400 font-mono">
                  cell ({hoverCell[0]}, {hoverCell[1]})
                  {hoverQ && hoverQ.length > 0 && (
                    <span className="ml-3">max Q: {hoverQ[0].toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>

            {/* Live stats */}
            <div className="card p-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-3">
                Live Stats
              </h3>
              {algoMeta.type === 'rl' && stats.totalEpisodes ? (
                <ProgressBar
                  value={progressFraction}
                  label={`Episode ${stats.episode ?? 0} / ${stats.totalEpisodes}`}
                  color={algoMeta.color}
                />
              ) : null}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                <Stat label="Reward" value={stats.reward?.toFixed(1) ?? '—'} />
                <Stat label="Steps" value={stats.steps ?? '—'} />
                <Stat
                  label="Best Path"
                  value={stats.bestPathLength ?? '—'}
                />
                <Stat
                  label="Time"
                  value={stats.timeElapsed !== undefined ? formatTime(stats.timeElapsed) : '—'}
                />
                {algoMeta.type === 'search' && (
                  <Stat label="States Explored" value={stats.nodesExplored ?? '—'} />
                )}
              </div>
            </div>

            {/* Charts */}
            {episodeStats.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                    Learning Curve
                  </h3>
                  <LearningCurveChart stats={episodeStats} color={algoMeta.color} />
                </div>
                <div className="card p-4">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                    Steps per Episode
                  </h3>
                  <StepsChart stats={episodeStats} color={algoMeta.color} />
                </div>
              </div>
            )}

            {(qValueGrid || visitGrid) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {qValueGrid && (
                  <div className="card p-4">
                    <HeatmapCanvas values={qValueGrid} title="Q-Value Heatmap (max Q per cell)" />
                  </div>
                )}
                {visitGrid && (
                  <div className="card p-4">
                    <HeatmapCanvas values={visitGrid} title="Exploration Heatmap (visits per cell)" />
                  </div>
                )}
              </div>
            )}

            <AlgorithmPanel algorithm={algorithm} />
          </div>

          {/* Controls */}
          <aside>
            <MazeControls
              size={size}
              onSizeChange={onSizeChange}
              onGenerate={onGenerate}
              onPreset={onPreset}
              onClear={onClear}
              editMode={editMode}
              onToggleEditMode={() => setEditMode((v) => !v)}
              algorithm={algorithm}
              onAlgorithmChange={setAlgorithm}
              rlParams={rlParams}
              onRLParamsChange={setRLParams}
              speed={speed}
              onSpeedChange={setSpeed}
              onRun={onRun}
              onRunAll={onRunAll}
              isRunning={isRunning}
              onStop={onStop}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-gray-100">{value}</div>
    </div>
  );
}
