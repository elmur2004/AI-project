'use client';

import { useEffect, useRef } from 'react';
import type { GraphMaze } from '@/lib/graph/types';
import { COLORS } from '@/lib/utils/colors';

interface Props {
  graph: GraphMaze;
  path?: string[];
  pathColor?: string;
  explorationOrder?: string[];
  explorationProgress?: number; // 0..1
  showCosts?: boolean;
  height?: number;
  onHoverNode?: (id: string | null) => void;
}

export default function GraphCanvas({
  graph,
  path,
  pathColor = COLORS.start,
  explorationOrder,
  explorationProgress = 1,
  showCosts = true,
  height = 480,
  onHoverNode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = 30;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const pos = (id: string) => {
      const n = graph.nodes.find((nn) => nn.id === id)!;
      return { x: pad + n.x * innerW, y: pad + n.y * innerH };
    };

    const pathSet = new Set(path ?? []);
    const pathEdgeSet = new Set<string>();
    if (path && path.length > 1) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        pathEdgeSet.add(a < b ? `${a}|${b}` : `${b}|${a}`);
      }
    }
    const exploredSet = new Set<string>();
    if (explorationOrder && explorationOrder.length) {
      const upto = Math.floor(explorationOrder.length * explorationProgress);
      for (let i = 0; i < upto; i++) exploredSet.add(explorationOrder[i]);
    }

    // Edges
    ctx.lineCap = 'round';
    for (const e of graph.edges) {
      const a = pos(e.from);
      const b = pos(e.to);
      const ek = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
      const onPath = pathEdgeSet.has(ek);
      ctx.strokeStyle = onPath ? pathColor : 'rgba(156,163,175,0.35)';
      ctx.lineWidth = onPath ? 3.5 : 1.5;
      if (onPath) {
        ctx.shadowColor = pathColor;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Edge cost labels
    if (showCosts) {
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const e of graph.edges) {
        const a = pos(e.from);
        const b = pos(e.to);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        // Small background pill so the number stays readable over node lines
        const text = String(e.cost);
        const padding = 4;
        const metrics = ctx.measureText(text);
        const boxW = metrics.width + padding * 2;
        const boxH = 14;
        ctx.fillStyle = 'rgba(10,10,15,0.85)';
        ctx.fillRect(mx - boxW / 2, my - boxH / 2, boxW, boxH);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(text, mx, my);
      }
    }

    // Nodes
    for (const n of graph.nodes) {
      const p = pos(n.id);
      const isStart = n.id === graph.startId;
      const isGoal = n.id === graph.goalId;
      const isOnPath = pathSet.has(n.id);
      const isExplored = exploredSet.has(n.id);
      let fill = '#12121a';
      let stroke = 'rgba(156,163,175,0.6)';
      let r = 14;
      if (isStart) {
        fill = COLORS.start;
        stroke = COLORS.start;
        r = 16;
      } else if (isGoal) {
        fill = COLORS.goal;
        stroke = COLORS.goal;
        r = 16;
      } else if (isOnPath) {
        fill = pathColor;
        stroke = pathColor;
      } else if (isExplored) {
        fill = 'rgba(99, 102, 241, 0.55)';
        stroke = 'rgba(99, 102, 241, 0.9)';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = isStart || isGoal || isOnPath ? '#0a0a0f' : '#e5e7eb';
      ctx.font = `bold ${n.label && n.label.length > 2 ? 9 : 11}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = n.label ?? n.id;
      ctx.fillText(label.length > 8 ? label.slice(0, 8) : label, p.x, p.y);
    }
  }, [graph, path, pathColor, explorationOrder, explorationProgress, showCosts, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHoverNode || !containerRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const pad = 30;
    const innerW = rect.width - pad * 2;
    const innerH = height - pad * 2;
    let hit: string | null = null;
    for (const n of graph.nodes) {
      const dx = mx - (pad + n.x * innerW);
      const dy = my - (pad + n.y * innerH);
      if (dx * dx + dy * dy < 16 * 16) {
        hit = n.id;
        break;
      }
    }
    onHoverNode(hit);
  };

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHoverNode?.(null)}
        className="rounded-md"
      />
    </div>
  );
}
