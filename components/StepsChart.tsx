'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { EpisodeStat } from '@/lib/maze/types';

interface Props {
  stats: EpisodeStat[];
  color?: string;
  height?: number;
}

export default function StepsChart({ stats, color = '#f59e0b', height = 240 }: Props) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={stats} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
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
          <Line
            type="monotone"
            dataKey="steps"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
