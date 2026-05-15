'use client';

import type { AlgorithmId } from '@/lib/maze/types';
import { ALGORITHMS } from '@/lib/maze/types';
import { SIZE_OPTIONS } from '@/lib/maze/presets';

export type Speed = 'slow' | 'medium' | 'fast' | 'instant';

export interface RLParams {
  episodes: number;
  learningRate: number;
  discountFactor: number;
  epsilon: number;
}

interface Props {
  size: number;
  onSizeChange: (s: number) => void;
  onGenerate: () => void;
  onPreset: (key: 'easy' | 'medium' | 'hard') => void;
  onClear: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;

  algorithm: AlgorithmId;
  onAlgorithmChange: (a: AlgorithmId) => void;

  rlParams: RLParams;
  onRLParamsChange: (p: RLParams) => void;

  speed: Speed;
  onSpeedChange: (s: Speed) => void;

  onRun: () => void;
  onRunAll: () => void;
  isRunning: boolean;
  onStop: () => void;
}

export default function MazeControls(props: Props) {
  const {
    size,
    onSizeChange,
    onGenerate,
    onPreset,
    onClear,
    editMode,
    onToggleEditMode,
    algorithm,
    onAlgorithmChange,
    rlParams,
    onRLParamsChange,
    speed,
    onSpeedChange,
    onRun,
    onRunAll,
    isRunning,
    onStop,
  } = props;

  const isRL = ALGORITHMS[algorithm].type === 'rl';

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <h3 className="text-sm uppercase tracking-wider text-gray-500">Maze Settings</h3>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Size</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSizeChange(s)}
                className={`px-2 py-1.5 rounded-md text-xs font-mono transition ${
                  size === s
                    ? 'bg-start text-base'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
                disabled={isRunning}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onGenerate} disabled={isRunning} className="btn btn-secondary text-sm">
            Generate Random
          </button>
          <button onClick={onClear} disabled={isRunning} className="btn btn-secondary text-sm">
            Clear Maze
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onPreset('easy')}
            disabled={isRunning}
            className="btn btn-secondary text-xs"
          >
            Easy
          </button>
          <button
            onClick={() => onPreset('medium')}
            disabled={isRunning}
            className="btn btn-secondary text-xs"
          >
            Medium
          </button>
          <button
            onClick={() => onPreset('hard')}
            disabled={isRunning}
            className="btn btn-secondary text-xs"
          >
            Hard
          </button>
        </div>
        <button
          onClick={onToggleEditMode}
          disabled={isRunning}
          className={`btn w-full text-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
        >
          {editMode ? 'Edit Mode: ON (click to toggle walls)' : 'Edit Mode: OFF'}
        </button>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="text-sm uppercase tracking-wider text-gray-500">Algorithm</h3>
        <div className="space-y-1.5">
          {(Object.keys(ALGORITHMS) as AlgorithmId[]).map((id) => {
            const meta = ALGORITHMS[id];
            const active = algorithm === id;
            return (
              <button
                key={id}
                onClick={() => onAlgorithmChange(id)}
                disabled={isRunning}
                className={`w-full text-left p-2.5 rounded-md transition border ${
                  active
                    ? 'border-white/20 bg-white/5'
                    : 'border-transparent bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: meta.color,
                      boxShadow: active ? `0 0 8px ${meta.color}` : undefined,
                    }}
                  />
                  <span className="text-sm font-medium text-gray-200">{meta.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 ml-4">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {isRL && (
        <section className="card p-4 space-y-3">
          <h3 className="text-sm uppercase tracking-wider text-gray-500">RL Hyperparameters</h3>
          <RLSlider
            label="Episodes"
            value={rlParams.episodes}
            min={100}
            max={2000}
            step={50}
            display={String(rlParams.episodes)}
            onChange={(v) => onRLParamsChange({ ...rlParams, episodes: v })}
            disabled={isRunning}
          />
          <RLSlider
            label="Learning Rate (α)"
            value={rlParams.learningRate}
            min={0.01}
            max={0.5}
            step={0.01}
            display={rlParams.learningRate.toFixed(2)}
            onChange={(v) => onRLParamsChange({ ...rlParams, learningRate: v })}
            disabled={isRunning}
          />
          <RLSlider
            label="Discount Factor (γ)"
            value={rlParams.discountFactor}
            min={0.8}
            max={0.99}
            step={0.01}
            display={rlParams.discountFactor.toFixed(2)}
            onChange={(v) => onRLParamsChange({ ...rlParams, discountFactor: v })}
            disabled={isRunning}
          />
          <RLSlider
            label="Initial Epsilon (ε)"
            value={rlParams.epsilon}
            min={0.5}
            max={1.0}
            step={0.05}
            display={rlParams.epsilon.toFixed(2)}
            onChange={(v) => onRLParamsChange({ ...rlParams, epsilon: v })}
            disabled={isRunning}
          />
        </section>
      )}

      <section className="card p-4 space-y-3">
        <h3 className="text-sm uppercase tracking-wider text-gray-500">Animation Speed</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {(['slow', 'medium', 'fast', 'instant'] as Speed[]).map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1.5 rounded-md text-xs capitalize transition ${
                speed === s
                  ? 'bg-start text-base'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        {isRunning ? (
          <button onClick={onStop} className="btn w-full bg-goal hover:bg-goal/90 text-base font-semibold">
            STOP
          </button>
        ) : (
          <button onClick={onRun} className="btn btn-primary w-full font-semibold text-base py-3">
            ▶ RUN {ALGORITHMS[algorithm].shortName}
          </button>
        )}
        <button
          onClick={onRunAll}
          disabled={isRunning}
          className="btn btn-secondary w-full text-sm"
        >
          Run All &amp; Compare
        </button>
      </div>
    </div>
  );
}

function RLSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-gray-200">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
