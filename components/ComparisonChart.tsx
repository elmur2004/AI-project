'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { AlgorithmId, ComparisonResult } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';

type Metric = 'pathLength' | 'executionTime' | 'nodesExplored';

interface Props {
  results: ComparisonResult[];
  metric: Metric;
  height?: number;
}

const METRIC_LABELS: Record<Metric, string> = {
  pathLength: 'Path Length',
  executionTime: 'Execution Time (ms)',
  nodesExplored: 'Nodes / States Explored',
};

export default function ComparisonChart({ results, metric, height = 260 }: Props) {
  const data = results.map((r) => ({
    name: ALGORITHMS[r.algorithm].shortName,
    value: metric === 'executionTime' ? Math.round(r[metric] * 100) / 100 : r[metric],
    color: ALGORITHMS[r.algorithm].color,
    id: r.algorithm,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <div className="text-sm text-gray-400 mb-2">{METRIC_LABELS[metric]}</div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
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
          <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.id as AlgorithmId} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
