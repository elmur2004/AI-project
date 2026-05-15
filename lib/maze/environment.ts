import {
  ACTION_DELTAS,
  type Action,
  type Cell,
  type MazeState,
  type StepResult,
  REWARDS,
} from './types';
import { keyOf } from '../utils/helpers';

export class MazeEnvironment {
  maze: number[][];
  rows: number;
  cols: number;
  start: Cell;
  goal: Cell;
  currentState: MazeState;
  maxSteps: number;

  constructor(maze: number[][], start: Cell, goal: Cell, maxSteps?: number) {
    this.maze = maze;
    this.rows = maze.length;
    this.cols = maze[0].length;
    this.start = start;
    this.goal = goal;
    this.maxSteps = maxSteps ?? this.rows * this.cols * 4;
    this.currentState = this.makeInitialState();
  }

  private makeInitialState(): MazeState {
    return {
      position: [this.start[0], this.start[1]],
      visited: new Set([keyOf(this.start[0], this.start[1])]),
      totalReward: 0,
      steps: 0,
    };
  }

  reset(): MazeState {
    this.currentState = this.makeInitialState();
    return this.currentState;
  }

  isWall(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
    return this.maze[row][col] === 1;
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  getValidActions(position: Cell): Action[] {
    const valid: Action[] = [];
    for (let a = 0 as Action; a < 4; a = (a + 1) as Action) {
      const [dr, dc] = ACTION_DELTAS[a];
      const nr = position[0] + dr;
      const nc = position[1] + dc;
      if (!this.isWall(nr, nc)) valid.push(a);
    }
    return valid;
  }

  step(action: Action): StepResult {
    const [r, c] = this.currentState.position;
    const [dr, dc] = ACTION_DELTAS[action];
    const nr = r + dr;
    const nc = c + dc;

    let reward = 0;
    let hitWall = false;
    let revisit = false;
    let reachedGoal = false;
    let nextPos: Cell = [r, c];

    if (this.isWall(nr, nc)) {
      reward = REWARDS.WALL_HIT;
      hitWall = true;
    } else {
      nextPos = [nr, nc];
      const key = keyOf(nr, nc);
      if (this.currentState.visited.has(key)) {
        reward = REWARDS.REVISIT;
        revisit = true;
      } else {
        reward = REWARDS.STEP;
      }
      if (nr === this.goal[0] && nc === this.goal[1]) {
        reward = REWARDS.GOAL;
        reachedGoal = true;
      }
    }

    const newVisited = new Set(this.currentState.visited);
    newVisited.add(keyOf(nextPos[0], nextPos[1]));

    const nextState: MazeState = {
      position: nextPos,
      visited: newVisited,
      totalReward: this.currentState.totalReward + reward,
      steps: this.currentState.steps + 1,
    };

    this.currentState = nextState;
    const done = reachedGoal || nextState.steps >= this.maxSteps;

    return {
      nextState,
      reward,
      done,
      info: { hitWall, revisit, reachedGoal },
    };
  }
}
