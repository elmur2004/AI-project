'use client';

interface Props {
  value: number; // 0..1
  label?: string;
  color?: string;
}

export default function ProgressBar({ value, label, color = '#00b894' }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>{label}</span>
          <span className="font-mono">{pct}%</span>
        </div>
      )}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
