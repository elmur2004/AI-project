'use client';

import type { ComparisonResult } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import { formatTime } from '@/lib/utils/helpers';

interface Props {
  results: ComparisonResult[];
}

export default function ComparisonTable({ results }: Props) {
  // Find best per metric for highlighting
  const valid = results.filter((r) => r.pathFound);
  const bestPath =
    valid.length > 0 ? Math.min(...valid.map((r) => r.pathLength)) : Infinity;
  const bestTime =
    valid.length > 0 ? Math.min(...valid.map((r) => r.executionTime)) : Infinity;
  const bestExpl =
    valid.length > 0 ? Math.min(...valid.map((r) => r.nodesExplored)) : Infinity;

  const cellHL = (active: boolean) => (active ? 'text-start font-semibold' : 'text-gray-200');

  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm">
        <thead className="text-gray-400 border-b border-white/5">
          <tr>
            <th className="text-left p-3 font-medium">Algorithm</th>
            <th className="text-right p-3 font-medium">Found Path</th>
            <th className="text-right p-3 font-medium">Path Length</th>
            <th className="text-right p-3 font-medium">Execution Time</th>
            <th className="text-right p-3 font-medium">States Explored</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const meta = ALGORITHMS[r.algorithm];
            return (
              <tr
                key={r.algorithm}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="text-gray-200">{meta.name}</span>
                  </div>
                </td>
                <td className="text-right p-3">
                  {r.pathFound ? (
                    <span className="text-start">Yes</span>
                  ) : (
                    <span className="text-goal">No</span>
                  )}
                </td>
                <td className={`text-right p-3 font-mono ${cellHL(r.pathLength === bestPath && r.pathFound)}`}>
                  {r.pathFound ? r.pathLength : '—'}
                </td>
                <td className={`text-right p-3 font-mono ${cellHL(r.executionTime === bestTime)}`}>
                  {formatTime(r.executionTime)}
                </td>
                <td className={`text-right p-3 font-mono ${cellHL(r.nodesExplored === bestExpl)}`}>
                  {r.nodesExplored}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
