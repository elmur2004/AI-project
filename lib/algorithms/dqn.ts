import type { Action, Cell, EpisodeStat, TrainingResult } from '../maze/types';
import { MazeEnvironment } from '../maze/environment';
import { yieldToUI, keyOf } from '../utils/helpers';

interface Layer {
  weights: number[][]; // [out][in]
  biases: number[]; // [out]
  // Cached during forward pass for backprop
  lastInput?: number[];
  lastZ?: number[]; // pre-activation
  lastA?: number[]; // post-activation
}

function relu(x: number): number {
  return x > 0 ? x : 0;
}
function reluDeriv(x: number): number {
  return x > 0 ? 1 : 0;
}

// Xavier-ish initialization
function initLayer(inSize: number, outSize: number): Layer {
  const scale = Math.sqrt(2 / inSize);
  const weights: number[][] = Array.from({ length: outSize }, () =>
    Array.from({ length: inSize }, () => (Math.random() * 2 - 1) * scale)
  );
  const biases = Array.from({ length: outSize }, () => 0);
  return { weights, biases };
}

export class NeuralNetwork {
  layers: Layer[];
  layerSizes: number[];

  constructor(layerSizes: number[]) {
    this.layerSizes = layerSizes;
    this.layers = [];
    for (let i = 0; i < layerSizes.length - 1; i++) {
      this.layers.push(initLayer(layerSizes[i], layerSizes[i + 1]));
    }
  }

  forward(input: number[]): number[] {
    let a = input.slice();
    for (let li = 0; li < this.layers.length; li++) {
      const layer = this.layers[li];
      const isLast = li === this.layers.length - 1;
      layer.lastInput = a;
      const z = new Array(layer.biases.length);
      const out = new Array(layer.biases.length);
      for (let i = 0; i < layer.biases.length; i++) {
        let sum = layer.biases[i];
        const w = layer.weights[i];
        for (let j = 0; j < w.length; j++) sum += w[j] * a[j];
        z[i] = sum;
        out[i] = isLast ? sum : relu(sum); // linear output for Q-values
      }
      layer.lastZ = z;
      layer.lastA = out;
      a = out;
    }
    return a;
  }

  // Single-sample backward pass with MSE on the output (Q-target diff).
  // `targetMask` lets us update only specific outputs (the taken action).
  backward(target: number[], learningRate: number, targetMask?: boolean[]) {
    const L = this.layers.length;
    // Gradient w.r.t. output activations
    const outLayer = this.layers[L - 1];
    const outA = outLayer.lastA!;
    let dA: number[] = new Array(outA.length);
    for (let i = 0; i < outA.length; i++) {
      if (targetMask && !targetMask[i]) {
        dA[i] = 0;
      } else {
        dA[i] = outA[i] - target[i]; // dL/dA for MSE (factor of 2 absorbed in LR)
      }
    }

    for (let li = L - 1; li >= 0; li--) {
      const layer = this.layers[li];
      const isLast = li === L - 1;
      const z = layer.lastZ!;
      const input = layer.lastInput!;
      // dZ
      const dZ = new Array(z.length);
      for (let i = 0; i < z.length; i++) {
        dZ[i] = isLast ? dA[i] : dA[i] * reluDeriv(z[i]);
      }
      // Gradients
      const newDA = new Array(input.length).fill(0);
      for (let i = 0; i < z.length; i++) {
        const w = layer.weights[i];
        const dzi = dZ[i];
        for (let j = 0; j < w.length; j++) {
          newDA[j] += w[j] * dzi;
          w[j] -= learningRate * dzi * input[j];
        }
        layer.biases[i] -= learningRate * dzi;
      }
      dA = newDA;
    }
  }

  cloneFrom(other: NeuralNetwork) {
    for (let li = 0; li < this.layers.length; li++) {
      const dst = this.layers[li];
      const src = other.layers[li];
      for (let i = 0; i < dst.weights.length; i++) {
        for (let j = 0; j < dst.weights[i].length; j++) {
          dst.weights[i][j] = src.weights[i][j];
        }
        dst.biases[i] = src.biases[i];
      }
    }
  }
}

interface Experience {
  state: number[];
  action: Action;
  reward: number;
  nextState: number[];
  done: boolean;
}

export interface DQNConfig {
  hiddenLayers: number[];
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  batchSize: number;
  bufferSize: number;
  targetUpdateEvery: number; // episodes
  trainEvery: number; // steps
}

export const DEFAULT_DQN_CONFIG: DQNConfig = {
  hiddenLayers: [32, 32],
  learningRate: 0.01,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.99,
  epsilonMin: 0.05,
  batchSize: 16,
  bufferSize: 2000,
  targetUpdateEvery: 10,
  trainEvery: 4,
};

export class DQNAgent {
  network: NeuralNetwork;
  targetNetwork: NeuralNetwork;
  buffer: Experience[] = [];
  config: DQNConfig;
  epsilon: number;
  rows: number;
  cols: number;
  inputSize = 2;
  outputSize = 4;

  constructor(rows: number, cols: number, config: Partial<DQNConfig> = {}) {
    this.rows = rows;
    this.cols = cols;
    this.config = { ...DEFAULT_DQN_CONFIG, ...config };
    this.epsilon = this.config.epsilon;
    const layout = [this.inputSize, ...this.config.hiddenLayers, this.outputSize];
    this.network = new NeuralNetwork(layout);
    this.targetNetwork = new NeuralNetwork(layout);
    this.targetNetwork.cloneFrom(this.network);
  }

  private encodeState(pos: Cell): number[] {
    // Normalize coords to [0,1]
    return [pos[0] / Math.max(1, this.rows - 1), pos[1] / Math.max(1, this.cols - 1)];
  }

  chooseAction(state: Cell, validActions: Action[], greedy = false): Action {
    if (!greedy && Math.random() < this.epsilon) {
      return validActions[Math.floor(Math.random() * validActions.length)];
    }
    const q = this.network.forward(this.encodeState(state));
    let best: Action = validActions[0];
    let bestVal = -Infinity;
    for (const a of validActions) {
      if (q[a] > bestVal) {
        bestVal = q[a];
        best = a;
      }
    }
    return best;
  }

  storeExperience(exp: Experience) {
    if (this.buffer.length >= this.config.bufferSize) this.buffer.shift();
    this.buffer.push(exp);
  }

  replay() {
    if (this.buffer.length < this.config.batchSize) return;
    for (let i = 0; i < this.config.batchSize; i++) {
      const exp = this.buffer[Math.floor(Math.random() * this.buffer.length)];
      const qCurrent = this.network.forward(exp.state).slice();
      const qNextTarget = this.targetNetwork.forward(exp.nextState);
      const maxNext = Math.max(...qNextTarget);
      const target = exp.done
        ? exp.reward
        : exp.reward + this.config.discountFactor * maxNext;
      const targetVec = qCurrent.slice();
      targetVec[exp.action] = target;
      const mask = [false, false, false, false];
      mask[exp.action] = true;
      // Re-run forward to populate caches (state may have been overwritten)
      this.network.forward(exp.state);
      this.network.backward(targetVec, this.config.learningRate, mask);
    }
  }

  async train(
    env: MazeEnvironment,
    episodes: number,
    onEpisodeComplete?: (ep: number, reward: number, steps: number, path: Cell[]) => void,
    yieldEvery = 5
  ): Promise<TrainingResult> {
    const t0 = performance.now();
    const stats: EpisodeStat[] = [];
    let bestReward = -Infinity;
    let bestPathLen = Infinity;
    let stepCounter = 0;

    for (let ep = 0; ep < episodes; ep++) {
      let state = env.reset();
      const path: Cell[] = [state.position];
      let totalReward = 0;
      let steps = 0;
      let done = false;

      while (!done) {
        const valid = env.getValidActions(state.position);
        const action = this.chooseAction(state.position, valid);
        const encState = this.encodeState(state.position);
        const result = env.step(action);
        const encNext = this.encodeState(result.nextState.position);
        this.storeExperience({
          state: encState,
          action,
          reward: result.reward,
          nextState: encNext,
          done: result.done,
        });
        stepCounter++;
        if (stepCounter % this.config.trainEvery === 0) this.replay();
        state = result.nextState;
        totalReward += result.reward;
        steps++;
        path.push(state.position);
        done = result.done;
      }

      this.epsilon = Math.max(
        this.config.epsilonMin,
        this.epsilon * this.config.epsilonDecay
      );

      if ((ep + 1) % this.config.targetUpdateEvery === 0) {
        this.targetNetwork.cloneFrom(this.network);
      }

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

  getLearnedPath(env: MazeEnvironment, maxSteps?: number): Cell[] {
    const limit = maxSteps ?? env.rows * env.cols * 2;
    env.reset();
    const path: Cell[] = [env.currentState.position];
    const seen = new Set<string>();
    seen.add(keyOf(env.currentState.position[0], env.currentState.position[1]));
    for (let i = 0; i < limit; i++) {
      const valid = env.getValidActions(env.currentState.position);
      if (valid.length === 0) break;
      const action = this.chooseAction(env.currentState.position, valid, true);
      const result = env.step(action);
      const k = keyOf(result.nextState.position[0], result.nextState.position[1]);
      path.push(result.nextState.position);
      if (result.info.reachedGoal) return path;
      if (seen.has(k)) break;
      seen.add(k);
      if (result.done) break;
    }
    return path;
  }
}
