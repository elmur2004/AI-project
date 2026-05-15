import type {
  Action,
  Cell,
  EpisodeStat,
  TrainingResult,
} from '../maze/types';
import { MazeEnvironment } from '../maze/environment';
import { keyOf, yieldToUI } from '../utils/helpers';

export interface QLearningConfig {
  learningRate: number; // alpha
  discountFactor: number; // gamma
  epsilon: number; // initial epsilon
  epsilonDecay: number;
  epsilonMin: number;
}

export const DEFAULT_QL_CONFIG: QLearningConfig = {
  learningRate: 0.1,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.995,
  epsilonMin: 0.05,
};

export type EpisodeCallback = (
  episode: number,
  reward: number,
  steps: number,
  path: Cell[]
) => void;

export class QLearningAgent {
  qTable: Map<string, number[]>; // key -> [Q(up), Q(down), Q(left), Q(right)]
  config: QLearningConfig;
  epsilon: number;

  constructor(config: Partial<QLearningConfig> = {}) {
    this.config = { ...DEFAULT_QL_CONFIG, ...config };
    this.epsilon = this.config.epsilon;
    this.qTable = new Map();
  }

  private getQValues(state: string): number[] {
    let q = this.qTable.get(state);
    if (!q) {
      q = [0, 0, 0, 0];
      this.qTable.set(state, q);
    }
    return q;
  }

  chooseAction(state: string, validActions: Action[], greedy = false): Action {
    if (!greedy && Math.random() < this.epsilon) {
      return validActions[Math.floor(Math.random() * validActions.length)];
    }
    const q = this.getQValues(state);
    // Pick action with highest Q among valid actions; ties broken randomly.
    let bestActions: Action[] = [];
    let bestVal = -Infinity;
    for (const a of validActions) {
      if (q[a] > bestVal) {
        bestVal = q[a];
        bestActions = [a];
      } else if (q[a] === bestVal) {
        bestActions.push(a);
      }
    }
    return bestActions[Math.floor(Math.random() * bestActions.length)];
  }

  update(state: string, action: Action, reward: number, nextState: string): void {
    const q = this.getQValues(state);
    const nextQ = this.getQValues(nextState);
    const maxNext = Math.max(...nextQ);
    const target = reward + this.config.discountFactor * maxNext;
    q[action] = q[action] + this.config.learningRate * (target - q[action]);
  }

  decayEpsilon() {
    this.epsilon = Math.max(this.config.epsilonMin, this.epsilon * this.config.epsilonDecay);
  }

  async train(
    env: MazeEnvironment,
    episodes: number,
    onEpisodeComplete?: EpisodeCallback,
    yieldEvery = 25
  ): Promise<TrainingResult> {
    const t0 = performance.now();
    const stats: EpisodeStat[] = [];
    let bestReward = -Infinity;
    let bestPathLen = Infinity;

    for (let ep = 0; ep < episodes; ep++) {
      let state = env.reset();
      let stateKey = keyOf(state.position[0], state.position[1]);
      const path: Cell[] = [state.position];
      let totalReward = 0;
      let steps = 0;
      let done = false;

      while (!done) {
        const valid = env.getValidActions(state.position);
        const action = this.chooseAction(stateKey, valid);
        const result = env.step(action);
        const nextKey = keyOf(result.nextState.position[0], result.nextState.position[1]);
        this.update(stateKey, action, result.reward, nextKey);
        state = result.nextState;
        stateKey = nextKey;
        totalReward += result.reward;
        steps++;
        path.push(state.position);
        done = result.done;
      }

      this.decayEpsilon();
      stats.push({ episode: ep + 1, reward: totalReward, steps, epsilon: this.epsilon });
      if (totalReward > bestReward) bestReward = totalReward;
      if (path[path.length - 1][0] === env.goal[0] && path[path.length - 1][1] === env.goal[1]) {
        if (path.length < bestPathLen) bestPathLen = path.length;
      }

      if (onEpisodeComplete) onEpisodeComplete(ep + 1, totalReward, steps, path);
      if ((ep + 1) % yieldEvery === 0) await yieldToUI();
    }

    const finalPath = this.getLearnedPath(env);
    return {
      episodeStats: stats,
      finalPath,
      executionTime: performance.now() - t0,
      totalEpisodes: episodes,
      bestPathLength: isFinite(bestPathLen) ? bestPathLen : 0,
      bestReward,
    };
  }

  // Greedy roll-out from start; used to extract the learned policy's path.
  getLearnedPath(env: MazeEnvironment, maxSteps?: number): Cell[] {
    const limit = maxSteps ?? env.rows * env.cols * 2;
    env.reset();
    const path: Cell[] = [env.currentState.position];
    const seen = new Set<string>();
    seen.add(keyOf(env.currentState.position[0], env.currentState.position[1]));
    for (let i = 0; i < limit; i++) {
      const valid = env.getValidActions(env.currentState.position);
      if (valid.length === 0) break;
      const stateKey = keyOf(env.currentState.position[0], env.currentState.position[1]);
      const action = this.chooseAction(stateKey, valid, true);
      const result = env.step(action);
      const k = keyOf(result.nextState.position[0], result.nextState.position[1]);
      path.push(result.nextState.position);
      if (result.info.reachedGoal) return path;
      if (seen.has(k)) {
        // Stuck in a loop — break to avoid infinite path.
        break;
      }
      seen.add(k);
      if (result.done) break;
    }
    return path;
  }

  getQValues_(): Map<string, number[]> {
    return this.qTable;
  }
}
