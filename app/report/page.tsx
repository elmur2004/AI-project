'use client';

import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CodeBlock from '@/components/CodeBlock';
import ComparisonTable from '@/components/ComparisonTable';
import ComparisonChart from '@/components/ComparisonChart';
import { generateMaze } from '@/lib/maze/generator';
import { astar } from '@/lib/algorithms/astar';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { MazeEnvironment } from '@/lib/maze/environment';
import { QLearningAgent } from '@/lib/algorithms/qlearning';
import { DQNAgent } from '@/lib/algorithms/dqn';
import type { Cell, ComparisonResult } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import { formatTime } from '@/lib/utils/helpers';

export default function ReportPage() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [resultsReady, setResultsReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadStage, setDownloadStage] = useState('');
  const articleRef = useRef<HTMLElement>(null);

  // Run all algorithms on a fixed-size maze for the embedded results section.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const maze = generateMaze(15, 15);
      const start: Cell = [0, 0];
      const goal: Cell = [maze.length - 1, maze[0].length - 1];

      const out: ComparisonResult[] = [];
      // Search algorithms — instant
      const ar = astar(maze, start, goal);
      out.push({
        algorithm: 'astar',
        pathLength: ar.path.length,
        executionTime: ar.executionTime,
        nodesExplored: ar.nodesExplored,
        pathFound: ar.found,
        path: ar.path,
      });
      const dr = dijkstra(maze, start, goal);
      out.push({
        algorithm: 'dijkstra',
        pathLength: dr.path.length,
        executionTime: dr.executionTime,
        nodesExplored: dr.nodesExplored,
        pathFound: dr.found,
        path: dr.path,
      });
      if (!cancelled) setResults(out.slice());

      // Q-Learning
      await new Promise((r) => setTimeout(r, 0));
      const qenv = new MazeEnvironment(maze, start, goal);
      const qagent = new QLearningAgent({ epsilon: 1.0 });
      let qSeen = new Set<string>();
      const qres = await qagent.train(qenv, 400, (_e, _r, _s, path) => {
        for (const [r, c] of path) qSeen.add(`${r},${c}`);
      });
      const qReached =
        qres.finalPath.length > 0 &&
        qres.finalPath[qres.finalPath.length - 1][0] === goal[0] &&
        qres.finalPath[qres.finalPath.length - 1][1] === goal[1];
      out.push({
        algorithm: 'qlearning',
        pathLength: qReached ? qres.finalPath.length : 0,
        executionTime: qres.executionTime,
        nodesExplored: qSeen.size,
        pathFound: qReached,
        path: qres.finalPath,
      });
      if (!cancelled) setResults(out.slice());

      // DQN — keep episodes modest so report loads in reasonable time
      await new Promise((r) => setTimeout(r, 0));
      const denv = new MazeEnvironment(maze, start, goal);
      const dagent = new DQNAgent(maze.length, maze[0].length, { epsilon: 1.0 });
      let dSeen = new Set<string>();
      const dres = await dagent.train(denv, 200, (_e, _r, _s, path) => {
        for (const [r, c] of path) dSeen.add(`${r},${c}`);
      });
      const dReached =
        dres.finalPath.length > 0 &&
        dres.finalPath[dres.finalPath.length - 1][0] === goal[0] &&
        dres.finalPath[dres.finalPath.length - 1][1] === goal[1];
      out.push({
        algorithm: 'dqn',
        pathLength: dReached ? dres.finalPath.length : 0,
        executionTime: dres.executionTime,
        nodesExplored: dSeen.size,
        pathFound: dReached,
        path: dres.finalPath,
      });
      if (!cancelled) {
        setResults(out.slice());
        setResultsReady(true);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadPDF = async () => {
    if (!articleRef.current || downloading) return;
    setDownloading(true);
    setDownloadStage('Loading PDF engine...');
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const { jsPDF } = jspdfMod;

      // Switch the article into a print-friendly mode (white bg, dark text)
      const el = articleRef.current!;
      el.classList.add('pdf-export');
      // Wait two frames so styles take effect
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      setDownloadStage('Rendering pages (high resolution)...');
      const canvas = await html2canvas(el, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      el.classList.remove('pdf-export');

      setDownloadStage('Assembling PDF...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8; // mm
      const usableW = pageW - margin * 2;
      const ratio = canvas.width / usableW; // px per mm
      const pageHpx = pageH * ratio;

      const imgData = canvas.toDataURL('image/png');
      const totalPages = Math.ceil(canvas.height / pageHpx);

      // We slice the source canvas vertically into per-page images so each PDF
      // page renders crisply at the device pixel size, instead of squishing the
      // whole thing to one page.
      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage();
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pageHpx, canvas.height - p * pageHpx);
        const sctx = sliceCanvas.getContext('2d')!;
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sctx.drawImage(
          canvas,
          0,
          p * pageHpx,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          sliceCanvas.width,
          sliceCanvas.height
        );
        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = sliceCanvas.height / ratio;
        pdf.addImage(sliceData, 'PNG', margin, margin, usableW, sliceHeightMm, undefined, 'FAST');

        // Page number
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(
          `Page ${p + 1} / ${totalPages}`,
          pageW - margin,
          pageH - 4,
          { align: 'right' }
        );
        pdf.text('Maze Solver AI — Final Report', margin, pageH - 4);
      }

      pdf.save('maze-solver-report.pdf');
      setDownloadStage('Saved.');
    } catch (e) {
      console.error(e);
      setDownloadStage('Failed to generate PDF — see console.');
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadStage('');
      }, 800);
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-gray-200">
        <div className="no-print flex justify-end items-center gap-3 mb-4">
          {downloading && (
            <span className="text-xs text-gray-400 font-mono">{downloadStage}</span>
          )}
          <button
            onClick={downloadPDF}
            disabled={downloading || !resultsReady}
            className="btn btn-primary text-sm font-semibold"
            title={!resultsReady ? 'Waiting for results to finish computing…' : 'Download high-quality PDF'}
          >
            {downloading ? 'Generating…' : '⬇ Download PDF'}
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary text-sm">
            Print
          </button>
        </div>

        <article ref={articleRef} className="space-y-10 leading-relaxed">
          <header className="text-center">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-2">
              AI University Project — Final Report
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold">
              Maze Solver using Reinforcement Learning and Search Algorithms
            </h1>
            <div className="mt-6 text-gray-300">
              <div>
                <span className="text-gray-500 text-sm">Team:</span>{' '}
                <span className="font-semibold">Ibrahim Abdelrahman Elmur</span>
              </div>
              <div className="mt-1">
                <span className="text-gray-500 text-sm">Presented to:</span>{' '}
                <span className="font-semibold text-start">Dr Sarah Khalil</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Course: Artificial Intelligence
              </div>
            </div>
          </header>

          {/* Abstract */}
          <Section title="Abstract">
            <p>
              This project investigates how classical graph-search algorithms (A* and
              Dijkstra's) and reinforcement learning agents (tabular Q-Learning and a
              deep Q-Network) perform on the same task: navigating a procedurally
              generated grid maze. We built a fully client-side interactive
              visualization in TypeScript that runs each algorithm in the browser,
              animates its behaviour, and presents head-to-head metrics. We discuss the
              trade-offs each method makes between sample efficiency, computational
              cost, and prior knowledge about the environment.
            </p>
          </Section>

          {/* Introduction */}
          <Section title="1. Introduction">
            <p>
              Maze solving is a canonical AI problem because it has a clean state space
              (a 2D grid), a clear objective (reach the goal), and admits both planning
              and learning approaches. It also makes excellent pedagogy: every
              algorithm's behaviour can be drawn directly on the maze, so the
              differences between search and reinforcement learning become visible
              rather than abstract.
            </p>
            <p>In this project we compare four algorithms on identical mazes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><b>A* Search</b> — informed search with a Manhattan-distance heuristic.</li>
              <li><b>Dijkstra's algorithm</b> — uninformed uniform-cost search.</li>
              <li><b>Tabular Q-Learning</b> — model-free RL that learns a Q(s,a) table.</li>
              <li><b>Deep Q-Network (DQN)</b> — function-approximated Q-learning using a small feed-forward neural network.</li>
            </ul>
          </Section>

          {/* Literature Review */}
          <Section title="2. Background and Related Work">
            <p>
              Dijkstra's algorithm (1959) finds shortest paths in graphs with
              non-negative edge weights using uniform-cost expansion. A* (Hart, Nilsson
              and Raphael, 1968) improves on this by guiding expansion with an
              admissible heuristic — for grid worlds, Manhattan distance is the
              standard choice.
            </p>
            <p>
              Reinforcement learning replaces the assumption of a known transition
              function with experience. Watkins' Q-Learning (1989) is the foundational
              tabular algorithm; Mnih et al. (2015) showed that neural networks can act
              as a function approximator for Q-values, enabling RL to scale to large or
              continuous state spaces. On a small grid like ours both should work;
              their relative performance is the interesting question.
            </p>
          </Section>

          {/* AI Algorithms & Tools */}
          <Section title="3. AI Algorithms and Tools">
            <SubSection title="3.1 Maze Environment">
              <p>
                A maze is an <span className="font-mono">R × C</span> integer grid where{' '}
                <span className="font-mono">0</span> denotes a walkable cell and{' '}
                <span className="font-mono">1</span> a wall. The start is the
                top-left walkable cell and the goal is the bottom-right walkable cell.
                Mazes are generated using a randomized depth-first search (recursive
                backtracking), then validated for reachability via BFS.
              </p>
              <p>
                The state is the agent's <span className="font-mono">(row, col)</span>{' '}
                position. The action space is four discrete moves:{' '}
                <span className="font-mono">UP, DOWN, LEFT, RIGHT</span>.
              </p>
            </SubSection>
            <SubSection title="3.2 Reward Design">
              <ul className="list-disc pl-6 space-y-1">
                <li><b>+100</b> on reaching the goal — strong terminal signal.</li>
                <li><b>−10</b> on attempting to move into a wall — discourages thrashing.</li>
                <li><b>−1</b> per legal step — biases the agent toward short paths.</li>
                <li><b>−3</b> for revisiting a previously-visited cell — gently penalizes cycles.</li>
              </ul>
              <p>
                The negative per-step reward combined with the large goal bonus makes
                shortest-path solutions reward-maximal under a γ &lt; 1 discount.
              </p>
            </SubSection>
            <SubSection title="3.3 Q-Learning">
              <p>
                We maintain a table <span className="font-mono">Q[s, a]</span>, initialized
                to zero. At each step we pick an action ε-greedily, observe the reward
                and next state, and apply the standard update:
              </p>
              <CodeBlock
                title="Q-learning update"
                language="formula"
                code={`Q(s,a)  <-  Q(s,a) + α [ r + γ · max_a' Q(s', a')  -  Q(s,a) ]`}
              />
              <p>
                Hyperparameters: <span className="font-mono">α = 0.1</span>,{' '}
                <span className="font-mono">γ = 0.95</span>, ε starts at{' '}
                <span className="font-mono">1.0</span> and decays multiplicatively to a
                floor of <span className="font-mono">0.05</span>.
              </p>
            </SubSection>
            <SubSection title="3.4 Deep Q-Network">
              <p>
                The DQN uses a small feed-forward network implemented from scratch in
                TypeScript — no external ML library. The architecture is{' '}
                <span className="font-mono">[2 → 32 → 32 → 4]</span> with ReLU
                activations in the hidden layers and linear outputs for the four
                Q-values. The input is the agent's normalized{' '}
                <span className="font-mono">(row/H, col/W)</span> position.
              </p>
              <NetworkDiagram />
              <p>
                We use a target network synced every 10 episodes, an experience replay
                buffer of 2000 transitions, and minibatch updates of size 16 every 4
                environment steps. Loss is mean-squared error between the network's
                Q-value for the taken action and the bootstrapped target
                <span className="font-mono"> r + γ · max_a' Q'(s', a')</span>.
              </p>
            </SubSection>
            <SubSection title="3.5 A* Search">
              <p>
                A* maintains a priority queue ordered by{' '}
                <span className="font-mono">f(n) = g(n) + h(n)</span>, where{' '}
                <span className="font-mono">g</span> is the cost from start and{' '}
                <span className="font-mono">h</span> is the Manhattan distance to the
                goal. Manhattan distance is admissible (never overestimates) on a
                4-connected grid with unit costs, so A* returns an optimal path.
              </p>
              <CodeBlock
                title="Manhattan heuristic"
                language="formula"
                code={`h( (r,c) , (gr,gc) ) = |r - gr| + |c - gc|`}
              />
            </SubSection>
            <SubSection title="3.6 Dijkstra's Algorithm">
              <p>
                Dijkstra is A* with <span className="font-mono">h ≡ 0</span>. With unit
                edge weights it expands states in BFS-like waves. It guarantees the
                optimal path but explores more states than A* because it lacks
                directional bias toward the goal.
              </p>
            </SubSection>
            <SubSection title="3.7 Implementation Stack">
              <ul className="list-disc pl-6 space-y-1">
                <li><b>Next.js 14</b> (App Router, static export) as the application framework.</li>
                <li><b>TypeScript</b> for all algorithms and UI.</li>
                <li><b>Tailwind CSS</b> for styling.</li>
                <li><b>HTML Canvas</b> for maze rendering and animation (DPI-aware).</li>
                <li><b>Recharts</b> for learning curves and bar charts.</li>
                <li><b>Framer Motion</b> for UI animations.</li>
                <li><b>jsPDF</b> + <b>html2canvas</b> for high-quality PDF export.</li>
              </ul>
              <p>
                All algorithms — including the DQN's neural network — run entirely
                client-side. There is no backend, no Python, and no external API.
              </p>
            </SubSection>
          </Section>

          {/* Results & Outcomes */}
          <Section title="4. Results and Outcomes">
            <p>
              All four algorithms were run on a freshly generated 15×15 maze when this
              report loaded. The numbers and chart below come from that live run.
            </p>
            <ResultsBlock results={results} ready={resultsReady} />
            <SubSection title="Discussion of Results">
              <p>
                <b>A* and Dijkstra</b> both return optimal paths. The advantage of A*
                shows up in the <i>states explored</i> column: the heuristic prunes
                branches that move away from the goal, so A* typically expands
                noticeably fewer cells than Dijkstra on the same maze.
              </p>
              <p>
                <b>Q-Learning</b> reliably converges to a working policy within a few
                hundred episodes, but its <i>wall-clock time</i> is orders of magnitude
                larger than the search algorithms — it has to discover the reward
                structure by trial and error rather than reading the maze directly.
              </p>
              <p>
                <b>DQN</b> is heavier per episode and converges more slowly on a small
                tabular world, but the same code generalises to far larger or
                continuous state spaces where a Q-table would be infeasible. On 15×15
                the tabular Q-Learner is normally sample-efficient enough that DQN is
                overkill; the comparison shows precisely that trade-off.
              </p>
            </SubSection>
            <SubSection title="Effectiveness vs Efficiency">
              <p>
                <i>Effectiveness</i> — does the algorithm find a goal-reaching path? In
                all live runs we observed, A*, Dijkstra, and Q-Learning converge to a
                valid path. DQN converges most of the time within 200 episodes; with a
                higher episode budget it converges reliably.
              </p>
              <p>
                <i>Efficiency</i> — at what cost? Search algorithms finish in
                milliseconds. RL agents trade wall-clock time for the ability to learn
                without a model. The right algorithm depends on what the system already
                knows about its environment.
              </p>
            </SubSection>
          </Section>

          {/* Discussion */}
          <Section title="5. Discussion">
            <p>
              <b>When to use search:</b> when you have the full map, can compute the
              graph, and want an optimal path immediately. A* dominates on grids with a
              good heuristic; Dijkstra is the right choice when no admissible heuristic
              is available.
            </p>
            <p>
              <b>When to use reinforcement learning:</b> when the environment is
              unknown, stochastic, or too large to plan over directly. Q-Learning is
              ideal for small discrete worlds. DQN's win is that the learned function
              generalises across states the agent has never seen, which matters in
              environments where a tabular representation is infeasible (continuous
              states, very large grids, image inputs).
            </p>
            <p>
              <b>Sample efficiency vs computation:</b> A* finishes in microseconds for
              a 15×15 maze; both RL agents need hundreds of episodes. The advantage of
              RL only shows up when the structure of the world is hidden or changes
              over time — neither of which is true for our static maze.
            </p>
          </Section>

          {/* Conclusion */}
          <Section title="6. Conclusion">
            <p>
              All four algorithms can solve a maze; their differences are in what they
              assume and what they spend. Search algorithms exchange a known model for
              immediate optimal answers; RL agents exchange wall-clock training time
              for not needing a model at all. We built an interactive visualization
              that makes these trade-offs tangible, and we offer it both as a teaching
              tool and as evidence that a meaningful comparison can be done entirely
              client-side in the browser.
            </p>
          </Section>

          {/* References */}
          <Section title="References">
            <ol className="list-decimal pl-6 space-y-2 text-sm text-gray-300">
              <li>Hart, P. E., Nilsson, N. J., &amp; Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. <i>IEEE Transactions on Systems Science and Cybernetics, 4</i>(2), 100–107.</li>
              <li>Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. <i>Numerische Mathematik, 1</i>(1), 269–271.</li>
              <li>Watkins, C. J. C. H. (1989). <i>Learning from delayed rewards</i> (Doctoral dissertation, University of Cambridge).</li>
              <li>Mnih, V., Kavukcuoglu, K., Silver, D., et al. (2015). Human-level control through deep reinforcement learning. <i>Nature, 518</i>(7540), 529–533.</li>
              <li>Sutton, R. S., &amp; Barto, A. G. (2018). <i>Reinforcement Learning: An Introduction</i> (2nd ed.). MIT Press.</li>
              <li>Russell, S., &amp; Norvig, P. (2021). <i>Artificial Intelligence: A Modern Approach</i> (4th ed.). Pearson.</li>
            </ol>
          </Section>
        </article>
      </main>
      <Footer />

      {/* PDF-export styling: applied just-in-time when generating the PDF so
          html2canvas captures a print-friendly white version. */}
      <style jsx global>{`
        .pdf-export {
          background: #ffffff !important;
          color: #111827 !important;
          padding: 16px !important;
        }
        .pdf-export * {
          color: #111827 !important;
          border-color: #d1d5db !important;
        }
        .pdf-export .card {
          background: #ffffff !important;
          border-color: #d1d5db !important;
        }
        .pdf-export pre, .pdf-export code {
          background: #f3f4f6 !important;
          color: #1f2937 !important;
        }
        .pdf-export .text-start { color: #047857 !important; }
        .pdf-export .text-goal { color: #b45309 !important; }
        .pdf-export .text-gray-200,
        .pdf-export .text-gray-300,
        .pdf-export .text-gray-400,
        .pdf-export .text-gray-500 {
          color: #374151 !important;
        }
        .pdf-export svg circle { fill: #1d4ed8 !important; }
        .pdf-export svg line { stroke: #1d4ed8 !important; }
        .pdf-export svg text { fill: #374151 !important; }
        .pdf-export .recharts-cartesian-grid line {
          stroke: #e5e7eb !important;
        }
        .pdf-export .recharts-text { fill: #374151 !important; }
      `}</style>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-semibold border-b border-white/10 pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-gray-300 leading-7">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pl-1">
      <h3 className="text-lg font-medium text-gray-100">{title}</h3>
      <div className="space-y-2 text-[15px] text-gray-300">{children}</div>
    </div>
  );
}

function ResultsBlock({ results, ready }: { results: ComparisonResult[]; ready: boolean }) {
  if (results.length === 0) {
    return (
      <div className="card p-4 text-sm text-gray-400">
        Computing live results on a 15×15 maze… (search algorithms run instantly; RL
        training takes a few seconds)
      </div>
    );
  }

  // Compute summary numbers
  const valid = results.filter((r) => r.pathFound);
  const minPath = valid.length ? Math.min(...valid.map((r) => r.pathLength)) : 0;
  const minTime = valid.length ? Math.min(...valid.map((r) => r.executionTime)) : 0;
  const minExpl = valid.length ? Math.min(...valid.map((r) => r.nodesExplored)) : 0;

  return (
    <div className="space-y-4">
      {!ready && (
        <div className="text-xs text-gray-500 italic">
          (RL training still in progress — partial results shown.)
        </div>
      )}

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {results.map((r) => {
          const meta = ALGORITHMS[r.algorithm];
          return (
            <div
              key={r.algorithm}
              className="card p-3"
              style={{ borderColor: `${meta.color}40` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="text-xs font-semibold text-gray-200">
                  {meta.shortName}
                </span>
              </div>
              <div className="space-y-1 text-xs font-mono text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-500">Path:</span>
                  <span className={r.pathFound && r.pathLength === minPath ? 'text-start' : ''}>
                    {r.pathFound ? `${r.pathLength}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time:</span>
                  <span className={r.executionTime === minTime ? 'text-start' : ''}>
                    {formatTime(r.executionTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">States:</span>
                  <span className={r.nodesExplored === minExpl ? 'text-start' : ''}>
                    {r.nodesExplored}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ComparisonTable results={results} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-3">
          <ComparisonChart results={results} metric="pathLength" height={220} />
        </div>
        <div className="card p-3">
          <ComparisonChart results={results} metric="executionTime" height={220} />
        </div>
        <div className="card p-3 sm:col-span-2">
          <ComparisonChart results={results} metric="nodesExplored" height={220} />
        </div>
      </div>
    </div>
  );
}

function NetworkDiagram() {
  return (
    <div className="card p-3 my-3">
      <svg viewBox="0 0 520 200" className="w-full h-auto">
        {[
          { x: 60, count: 2, label: 'Input (2)' },
          { x: 200, count: 5, label: 'Hidden 32 · ReLU' },
          { x: 340, count: 5, label: 'Hidden 32 · ReLU' },
          { x: 470, count: 4, label: 'Output (4 Q-values)' },
        ].map((layer, li, arr) => (
          <g key={li}>
            {Array.from({ length: layer.count }).map((_, i) => {
              const total = layer.count;
              const y = 30 + (i * 140) / Math.max(1, total - 1);
              return (
                <g key={i}>
                  <circle cx={layer.x} cy={y} r={8} fill="#3b82f6" opacity="0.9" />
                  {li < arr.length - 1 &&
                    Array.from({ length: arr[li + 1].count }).map((_, j) => {
                      const next = arr[li + 1];
                      const ny = 30 + (j * 140) / Math.max(1, next.count - 1);
                      return (
                        <line
                          key={j}
                          x1={layer.x + 8}
                          y1={y}
                          x2={next.x - 8}
                          y2={ny}
                          stroke="#3b82f6"
                          strokeOpacity="0.15"
                        />
                      );
                    })}
                </g>
              );
            })}
            <text
              x={layer.x}
              y={190}
              textAnchor="middle"
              fontSize="11"
              fill="#9ca3af"
              fontFamily="monospace"
            >
              {layer.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
