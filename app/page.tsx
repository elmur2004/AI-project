'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { generateMaze } from '@/lib/maze/generator';
import { astar } from '@/lib/algorithms/astar';
import { MazeEnvironment } from '@/lib/maze/environment';
import { COLORS } from '@/lib/utils/colors';
import { ALGORITHMS } from '@/lib/maze/types';
import type { Cell } from '@/lib/maze/types';

function HeroMazeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let maze = generateMaze(15, 25);
    let start: Cell = [0, 0];
    let goal: Cell = [maze.length - 1, maze[0].length - 1];
    let env = new MazeEnvironment(maze, start, goal);
    let solution = astar(maze, start, goal);
    let progress = 0;
    let restartAt = 0;
    let lastTime = performance.now();
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const draw = (t: number) => {
      const dt = t - lastTime;
      lastTime = t;
      progress += dt / 4500;
      if (progress >= 1.2) {
        if (!restartAt) restartAt = t + 500;
        if (t > restartAt) {
          maze = generateMaze(15, 25);
          start = [0, 0];
          goal = [maze.length - 1, maze[0].length - 1];
          env = new MazeEnvironment(maze, start, goal);
          solution = astar(maze, start, goal);
          progress = 0;
          restartAt = 0;
        }
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const rows = maze.length;
      const cols = maze[0].length;
      const cs = Math.min(w / cols, h / rows);
      const offX = (w - cs * cols) / 2;
      const offY = (h - cs * rows) / 2;

      ctx.clearRect(0, 0, w, h);
      // Faded paths/walls
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = maze[r][c] === 1 ? 'rgba(26,26,46,0.7)' : 'rgba(22,33,62,0.3)';
          ctx.fillRect(offX + c * cs, offY + r * cs, cs - 0.5, cs - 0.5);
        }
      }
      // Exploration wave
      const explCount = Math.floor(solution.explorationOrder.length * Math.min(progress * 1.4, 1));
      for (let i = 0; i < explCount; i++) {
        const [r, c] = solution.explorationOrder[i];
        ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
        ctx.fillRect(offX + c * cs, offY + r * cs, cs - 0.5, cs - 0.5);
      }
      // Path
      if (solution.path.length > 1) {
        const pathFrac = Math.max(0, Math.min(1, (progress - 0.5) * 2));
        const upto = Math.floor(solution.path.length * pathFrac);
        ctx.strokeStyle = COLORS.start;
        ctx.lineWidth = Math.max(2, cs * 0.18);
        ctx.lineCap = 'round';
        ctx.shadowColor = COLORS.start;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i < upto; i++) {
          const [r, c] = solution.path[i];
          const x = offX + c * cs + cs / 2;
          const y = offY + r * cs + cs / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            {mounted && <HeroMazeBackground />}
            <div className="absolute inset-0 bg-gradient-to-b from-base/40 via-base/70 to-base" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-xs sm:text-sm tracking-[0.3em] uppercase text-start mb-4">
                AI University Project
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                Maze Solver <span className="text-start">AI</span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
                Reinforcement Learning vs Search Algorithms. Interactive, in-browser, and
                fully visualized.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/maze" className="btn btn-primary px-6 py-3 font-semibold">
                  ▶ Try It Live
                </Link>
                <Link href="/comparison" className="btn btn-secondary px-6 py-3 font-semibold">
                  View Comparison
                </Link>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="mt-12 max-w-md mx-auto"
              >
                <div className="card p-5 text-left space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">
                    Project Credits
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">This project was done by</div>
                    <div className="text-lg font-semibold text-gray-100">
                      Ibrahim Abdelrahman Elmur
                    </div>
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <div className="text-xs text-gray-400">Presented to</div>
                    <div className="text-lg font-semibold text-start">
                      Dr Sarah Khalil
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Algorithm cards */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-semibold mb-8"
          >
            Four algorithms, one maze
          </motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(ALGORITHMS).map((meta, i) => (
              <motion.div
                key={meta.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="card p-5 relative group overflow-hidden"
                style={{
                  boxShadow: `inset 0 0 0 1px ${meta.color}10`,
                }}
              >
                <div
                  className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 group-hover:opacity-40 transition"
                  style={{ background: `radial-gradient(${meta.color}, transparent 70%)` }}
                />
                <div
                  className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center font-mono font-bold text-base"
                  style={{ background: meta.color, color: '#0a0a0f' }}
                >
                  {meta.shortName.charAt(0)}
                </div>
                <h3 className="font-semibold text-lg text-gray-100">{meta.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{meta.description}</p>
                <span className="mt-3 inline-block text-xs uppercase tracking-wider text-gray-500">
                  {meta.type === 'rl' ? 'Reinforcement Learning' : 'Search'}
                </span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Feature strip */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-3 gap-4">
          {[
            {
              title: '100% Client-Side',
              body: 'All algorithms — including a custom neural network for DQN — run in your browser. No backend.',
            },
            {
              title: 'Interactive Visuals',
              body: 'Watch search algorithms explore in real time and reinforcement learning agents train episode-by-episode.',
            },
            {
              title: 'Side-by-Side Comparison',
              body: 'Run all four algorithms on the same maze. Compare path length, time, and states explored.',
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card p-5"
            >
              <h3 className="font-semibold text-gray-100">{f.title}</h3>
              <p className="text-sm text-gray-400 mt-2">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
