import type { Cell } from '../maze/types';

export const keyOf = (r: number, c: number): string => `${r},${c}`;

export const parseKey = (key: string): Cell => {
  const [r, c] = key.split(',').map(Number);
  return [r, c];
};

export const manhattan = (a: Cell, b: Cell): number =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Yields control back to the event loop without a real delay (used in "instant" mode
// every N steps to keep the UI responsive during heavy training).
export const yieldToUI = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function formatTime(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
