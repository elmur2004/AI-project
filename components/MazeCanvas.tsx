'use client';

import { useEffect, useRef } from 'react';
import type { Cell } from '@/lib/maze/types';
import { COLORS } from '@/lib/utils/colors';

interface MazeCanvasProps {
  maze: number[][];
  start: Cell;
  goal: Cell;
  path?: Cell[];
  pathColor?: string;
  explorationOrder?: Cell[];
  explorationProgress?: number; // 0..1, how many explored cells to draw
  agentPosition?: Cell | null;
  trail?: Cell[];
  overlays?: { cells: Cell[]; color: string }[]; // for comparison overlays
  editable?: boolean;
  onToggleWall?: (r: number, c: number) => void;
  onHoverCell?: (cell: Cell | null) => void;
  cellSize?: number;
  showGrid?: boolean;
}

export default function MazeCanvas({
  maze,
  start,
  goal,
  path,
  pathColor = COLORS.start,
  explorationOrder,
  explorationProgress = 1,
  agentPosition,
  trail,
  overlays,
  editable = false,
  onToggleWall,
  onHoverCell,
  cellSize: forcedCellSize,
  showGrid = true,
}: MazeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rows = maze.length;
    const cols = maze[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    // Compute cell size to fit container, capped for readability.
    const availW = container.clientWidth;
    const availH = Math.min(container.clientHeight || availW, 720);
    const sizeFromContainer = Math.floor(Math.min(availW / cols, availH / rows));
    const cs = forcedCellSize ?? Math.max(8, Math.min(48, sizeFromContainer));

    const w = cs * cols;
    const h = cs * rows;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = COLORS.path;
    ctx.fillRect(0, 0, w, h);

    // Cells (walls vs paths)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cs;
        const y = r * cs;
        if (maze[r][c] === 1) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, cs, cs);
        }
      }
    }

    // Exploration tint
    if (explorationOrder && explorationOrder.length) {
      const upto = Math.floor(explorationOrder.length * explorationProgress);
      ctx.fillStyle = COLORS.exploration;
      for (let i = 0; i < upto; i++) {
        const [r, c] = explorationOrder[i];
        ctx.fillRect(c * cs, r * cs, cs, cs);
      }
    }

    // Comparison overlays
    if (overlays) {
      for (const ov of overlays) {
        ctx.fillStyle = ov.color;
        for (const [r, c] of ov.cells) {
          ctx.fillRect(c * cs + cs * 0.2, r * cs + cs * 0.2, cs * 0.6, cs * 0.6);
        }
      }
    }

    // Path
    if (path && path.length > 1) {
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = Math.max(2, cs * 0.18);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const x = c * cs + cs / 2;
        const y = r * cs + cs / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Trail
    if (trail && trail.length) {
      ctx.fillStyle = COLORS.trail;
      for (const [r, c] of trail) {
        ctx.fillRect(c * cs + cs * 0.3, r * cs + cs * 0.3, cs * 0.4, cs * 0.4);
      }
    }

    // Start and Goal
    const drawSpecial = (r: number, c: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c * cs + cs / 2, r * cs + cs / 2, cs * 0.32, 0, Math.PI * 2);
      ctx.fill();
    };
    drawSpecial(start[0], start[1], COLORS.start);
    drawSpecial(goal[0], goal[1], COLORS.goal);

    // Agent
    if (agentPosition) {
      const [r, c] = agentPosition;
      ctx.fillStyle = COLORS.agent;
      ctx.beginPath();
      ctx.arc(c * cs + cs / 2, r * cs + cs / 2, cs * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Grid
    if (showGrid && cs >= 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cs);
        ctx.lineTo(w, i * cs);
        ctx.stroke();
      }
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cs, 0);
        ctx.lineTo(i * cs, h);
        ctx.stroke();
      }
    }
  }, [
    maze,
    start,
    goal,
    path,
    pathColor,
    explorationOrder,
    explorationProgress,
    agentPosition,
    trail,
    overlays,
    forcedCellSize,
    showGrid,
  ]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable || !onToggleWall) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cs = rect.width / maze[0].length;
    const c = Math.floor((e.clientX - rect.left) / cs);
    const r = Math.floor((e.clientY - rect.top) / cs);
    if (r >= 0 && r < maze.length && c >= 0 && c < maze[0].length) {
      onToggleWall(r, c);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHoverCell) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cs = rect.width / maze[0].length;
    const c = Math.floor((e.clientX - rect.left) / cs);
    const r = Math.floor((e.clientY - rect.top) / cs);
    if (r >= 0 && r < maze.length && c >= 0 && c < maze[0].length) {
      onHoverCell([r, c]);
    } else {
      onHoverCell(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHoverCell?.(null)}
        className={`rounded-lg ${editable ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
