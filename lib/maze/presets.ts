import { generateMaze } from './generator';

// Hand-crafted-ish presets via deterministic generation seeds aren't trivial
// because Math.random isn't seedable, so we just regenerate at chosen sizes.
// The generator guarantees solvability, so this is fine for the UI.

export const PRESETS = {
  easy: () => generateMaze(10, 10),
  medium: () => generateMaze(15, 15),
  hard: () => generateMaze(20, 20),
} as const;

export type PresetKey = keyof typeof PRESETS;

export const SIZE_OPTIONS = [10, 15, 20, 25] as const;
export type SizeOption = (typeof SIZE_OPTIONS)[number];
