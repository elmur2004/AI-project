'use client';

import { useEffect, useRef } from 'react';

interface HeatmapCanvasProps {
  values: number[][]; // 2D grid
  title?: string;
  maxOverride?: number;
  colorRamp?: (t: number) => string; // t in [0,1]
  height?: number;
}

const defaultRamp = (t: number) => {
  // Blue (low) -> green -> yellow -> red (high)
  const r = Math.round(255 * Math.min(1, t * 1.5));
  const g = Math.round(255 * Math.min(1, t < 0.5 ? t * 2 : 2 - t * 2));
  const b = Math.round(255 * Math.max(0, 1 - t * 1.5));
  return `rgb(${r},${g},${b})`;
};

export default function HeatmapCanvas({
  values,
  title,
  maxOverride,
  colorRamp = defaultRamp,
  height = 220,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rows = values.length;
    const cols = values[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    const availW = container.clientWidth;
    const cs = Math.floor(Math.min(availW / cols, height / rows));
    if (cs <= 0) return;
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

    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = values[r][c];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (maxOverride !== undefined) max = maxOverride;
    const range = max - min || 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = (values[r][c] - min) / range;
        ctx.fillStyle = colorRamp(t);
        ctx.fillRect(c * cs, r * cs, cs, cs);
      }
    }
  }, [values, maxOverride, colorRamp, height]);

  return (
    <div className="w-full">
      {title && <div className="text-sm text-gray-400 mb-2">{title}</div>}
      <div ref={containerRef} className="w-full flex justify-center">
        <canvas ref={canvasRef} className="rounded-md" />
      </div>
    </div>
  );
}
