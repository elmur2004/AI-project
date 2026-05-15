import type { Cell } from './types';
import { shuffle } from '../utils/helpers';

// 0 = path, 1 = wall

export function generateMaze(rows: number, cols: number): number[][] {
  // Force odd dimensions so DFS carves cleanly.
  const R = rows % 2 === 0 ? rows + 1 : rows;
  const C = cols % 2 === 0 ? cols + 1 : cols;

  const maze: number[][] = Array.from({ length: R }, () => Array(C).fill(1));

  const carve = (r: number, c: number) => {
    maze[r][c] = 0;
    const dirs: Cell[] = shuffle([
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]);
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < R - 1 && nc > 0 && nc < C - 1 && maze[nr][nc] === 1) {
        maze[r + dr / 2][c + dc / 2] = 0;
        carve(nr, nc);
      }
    }
  };

  carve(1, 1);

  // Open up start and goal
  maze[1][1] = 0;
  maze[R - 2][C - 2] = 0;

  // Trim back to requested size if we expanded
  const trimmed = maze.slice(0, rows).map((row) => row.slice(0, cols));

  // Make sure start (0,0 area) and goal (rows-1, cols-1 area) are walkable
  trimmed[0][0] = 0;
  trimmed[rows - 1][cols - 1] = 0;
  // Ensure neighbors of start/goal are reachable
  if (trimmed[0][1] === 1 && trimmed[1][0] === 1) trimmed[0][1] = 0;
  if (trimmed[rows - 1][cols - 2] === 1 && trimmed[rows - 2][cols - 1] === 1) {
    trimmed[rows - 1][cols - 2] = 0;
  }

  // Validate; if not solvable, retry with a different seed (probabilistically rare).
  if (!validateMaze(trimmed, [0, 0], [rows - 1, cols - 1])) {
    return generateMaze(rows, cols);
  }
  return trimmed;
}

export function validateMaze(maze: number[][], start: Cell, goal: Cell): boolean {
  const rows = maze.length;
  const cols = maze[0].length;
  if (maze[start[0]][start[1]] === 1 || maze[goal[0]][goal[1]] === 1) return false;
  const visited = new Set<string>();
  const queue: Cell[] = [start];
  visited.add(`${start[0]},${start[1]}`);
  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (r === goal[0] && c === goal[1]) return true;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as Cell[]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        maze[nr][nc] === 0 &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

export function emptyMaze(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}
