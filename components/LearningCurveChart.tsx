'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { EpisodeStat } from '@/lib/maze/types';

interface Props {
  stats: EpisodeStat[];
  color?: string;
  height?: number;
}

export default function LearningCurveChart({ stats, color = '#3b82f6', height = 240 }: Props) {
  // Compute moving average for smooth curve
  const window = Math.max(5, Math.floor(stats.length / 50));
  const smoothed = stats.map((s, i) => {
    const lo = Math.max(0, i - window);
    const slice = stats.slice(lo, i + 1);
    const avg = slice.reduce((a, b) => a + b.reward, 0) / slice.length;
    return { episode: s.episode, reward: s.reward, smooth: Math.round(avg * 100) / 100 };
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={smoothed} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
          <XAxis dataKey="episode" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#12121a',
              border: '1px solid #ffffff15',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="reward"
            stroke={`${color}55`}
            strokeWidth={1}
            dot={false}
            name="Reward"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="smooth"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            name="Smoothed"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
