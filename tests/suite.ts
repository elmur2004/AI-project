/**
 * End-to-end test suite for the maze solver library.
 * Run with: npx tsx tests/suite.ts
 */
import { generateMaze, validateMaze, emptyMaze } from '../lib/maze/generator';
import { MazeEnvironment } from '../lib/maze/environment';
import {
  ACTIONS,
  ACTION_DELTAS,
  REWARDS,
  type Cell,
} from '../lib/maze/types';
import { astar } from '../lib/algorithms/astar';
import { dijkstra } from '../lib/algorithms/dijkstra';
import { bfs } from '../lib/algorithms/bfs';
import { dfs } from '../lib/algorithms/dfs';
import { QLearningAgent } from '../lib/algorithms/qlearning';
import { DQNAgent } from '../lib/algorithms/dqn';
import {
  generateGraphMaze,
  romaniaMap,
  adjacencyMap,
} from '../lib/graph/generator';
import {
  bfsGraph,
  dfsGraph,
  dijkstraGraph,
  astarGraph,
} from '../lib/graph/search';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, msg?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const fmsg = msg ? `${name}: ${msg}` : name;
    failures.push(fmsg);
    console.log(`  ✗ ${name}${msg ? ' — ' + msg : ''}`);
  }
}

function section(title: string) {
  console.log(`\n— ${title} —`);
}

function isPathConnected(maze: number[][], path: Cell[]): boolean {
  // Each step must move to a 4-adjacent walkable cell.
  if (path.length === 0) return false;
  const [sr, sc] = path[0];
  if (maze[sr][sc] === 1) return false;
  for (let i = 1; i < path.length; i++) {
    const [pr, pc] = path[i - 1];
    const [r, c] = path[i];
    if (maze[r][c] === 1) return false;
    const dr = Math.abs(r - pr);
    const dc = Math.abs(c - pc);
    if (dr + dc !== 1) return false;
  }
  return true;
}

async function runRound(round: number, title: string, fn: () => Promise<void> | void) {
  console.log(`\n========== Round ${round}: ${title} ==========`);
  await fn();
}

// =============================================================================
// Round 2 — Algorithm correctness
// =============================================================================
async function round2() {
  section('Generator produces solvable mazes (50 trials × 4 sizes)');
  for (const size of [10, 15, 20, 25]) {
    let solvable = 0;
    let connected = 0;
    for (let i = 0; i < 50; i++) {
      const m = generateMaze(size, size);
      const start: Cell = [0, 0];
      const goal: Cell = [size - 1, size - 1];
      if (validateMaze(m, start, goal)) solvable++;
      if (m[0][0] === 0 && m[size - 1][size - 1] === 0) connected++;
    }
    ok(`size ${size}: 50/50 solvable`, solvable === 50, `got ${solvable}`);
    ok(`size ${size}: start & goal walkable`, connected === 50, `got ${connected}`);
  }

  section('A* finds optimal path on a known maze');
  // Hand-built 5x5 with one forced corridor
  const m5: number[][] = [
    [0, 0, 0, 1, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
  ];
  const ar = astar(m5, [0, 0], [4, 4]);
  ok('A* found path', ar.found);
  ok('A* path connected', isPathConnected(m5, ar.path));
  // Column 3 is fully walled, forcing a dip through row 4. True optimum is 13
  // (verified independently against Dijkstra below).
  ok('A* path optimal length', ar.path.length === 13, `len=${ar.path.length}, expected 13`);

  section('Dijkstra finds same optimal length as A*');
  const dr = dijkstra(m5, [0, 0], [4, 4]);
  ok('Dijkstra found path', dr.found);
  ok('Dijkstra path connected', isPathConnected(m5, dr.path));
  ok(
    'Dijkstra optimal == A* optimal',
    dr.path.length === ar.path.length,
    `dij=${dr.path.length} astar=${ar.path.length}`
  );
  ok('Dijkstra explores >= A* states', dr.nodesExplored >= ar.nodesExplored);

  section('A* / Dijkstra agree on optimal length across 20 random mazes');
  let agree = 0;
  for (let i = 0; i < 20; i++) {
    const m = generateMaze(15, 15);
    const a = astar(m, [0, 0], [14, 14]);
    const d = dijkstra(m, [0, 0], [14, 14]);
    if (a.found && d.found && a.path.length === d.path.length) agree++;
  }
  ok('A* and Dijkstra agree 20/20', agree === 20, `got ${agree}`);

  section('Q-Learning converges to a solving policy');
  const qMaze = generateMaze(10, 10);
  const qEnv = new MazeEnvironment(qMaze, [0, 0], [9, 9]);
  const qAgent = new QLearningAgent({ epsilon: 1.0 });
  await qAgent.train(qEnv, 400);
  const qPath = qAgent.getLearnedPath(qEnv);
  const qReached =
    qPath.length > 0 &&
    qPath[qPath.length - 1][0] === 9 &&
    qPath[qPath.length - 1][1] === 9;
  ok('Q-Learning reaches goal', qReached, `final=${JSON.stringify(qPath[qPath.length - 1])}`);
  ok('Q-Learning path connected', isPathConnected(qMaze, qPath));

  section('DQN runs end-to-end without errors');
  const dMaze = generateMaze(10, 10);
  const dEnv = new MazeEnvironment(dMaze, [0, 0], [9, 9]);
  const dAgent = new DQNAgent(dMaze.length, dMaze[0].length, { epsilon: 1.0 });
  let dqnFinished = false;
  try {
    await dAgent.train(dEnv, 50); // short run for speed
    dqnFinished = true;
  } catch (e) {
    failures.push(`DQN train threw: ${(e as Error).message}`);
  }
  ok('DQN.train() completes without throwing', dqnFinished);
  const dPath = dAgent.getLearnedPath(dEnv);
  ok('DQN produces a non-empty path', dPath.length > 0);
}

// =============================================================================
// Round 3 — Edge cases
// =============================================================================
async function round3() {
  section('Empty maze (no walls) — all algorithms find direct path');
  const empty10 = emptyMaze(10, 10);
  const a = astar(empty10, [0, 0], [9, 9]);
  ok('A* on empty maze', a.found && isPathConnected(empty10, a.path));
  // Optimal Manhattan distance + 1 (for start cell) = 19
  ok('A* path length = 19 on empty 10x10', a.path.length === 19, `got ${a.path.length}`);
  const d = dijkstra(empty10, [0, 0], [9, 9]);
  ok('Dijkstra on empty maze', d.found && d.path.length === 19);

  section('All four supported sizes generate & solve');
  for (const size of [10, 15, 20, 25]) {
    const m = generateMaze(size, size);
    const r = astar(m, [0, 0], [size - 1, size - 1]);
    ok(`A* solves ${size}x${size}`, r.found && isPathConnected(m, r.path));
  }

  section('Single-corridor maze (manual edit)');
  // Start and goal walkable; everything else wall; one explicit S-shape.
  const m: number[][] = Array.from({ length: 5 }, () => Array(5).fill(1));
  m[0][0] = 0;
  m[0][1] = 0;
  m[0][2] = 0;
  m[1][2] = 0;
  m[2][2] = 0;
  m[2][3] = 0;
  m[2][4] = 0;
  m[3][4] = 0;
  m[4][4] = 0;
  const r = astar(m, [0, 0], [4, 4]);
  ok('Corridor maze: found path', r.found);
  ok('Corridor maze: exactly 9 cells', r.path.length === 9, `got ${r.path.length}`);
  ok('Corridor maze: path connected', isPathConnected(m, r.path));

  section('Unsolvable maze handled gracefully (start surrounded)');
  const blocked: number[][] = [
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 0],
  ];
  const ub = astar(blocked, [0, 0], [2, 2]);
  ok('Unsolvable: A* returns found=false', !ub.found);
  ok('Unsolvable: empty path', ub.path.length === 0, `path=${ub.path.length}`);
  const db = dijkstra(blocked, [0, 0], [2, 2]);
  ok('Unsolvable: Dijkstra returns found=false', !db.found);

  section('Manual wall toggle preserves connectivity if path exists');
  // Generate a maze; flip a path cell to a wall and re-check
  const m2 = generateMaze(15, 15);
  // Find first path cell that isn't start/goal
  let toFlip: Cell | null = null;
  outer: for (let r = 1; r < 14; r++) {
    for (let c = 1; c < 14; c++) {
      if (m2[r][c] === 0) {
        toFlip = [r, c];
        break outer;
      }
    }
  }
  ok('Found a cell to flip', toFlip !== null);
  if (toFlip) {
    const before = astar(m2, [0, 0], [14, 14]).found;
    m2[toFlip[0]][toFlip[1]] = 1;
    // After flipping one cell, the maze may or may not still be solvable
    // — both outcomes are acceptable; we just check we don't crash.
    const after = astar(m2, [0, 0], [14, 14]);
    ok('After wall flip, A* runs without crashing', typeof after.found === 'boolean');
    ok('Before flip was solvable', before === true);
  }
}

// =============================================================================
// Round 4 — Environment + reward correctness
// =============================================================================
async function round4() {
  section('REWARDS constants match spec');
  ok('GOAL = +100', REWARDS.GOAL === 100);
  ok('WALL_HIT = -10', REWARDS.WALL_HIT === -10);
  ok('STEP = -1', REWARDS.STEP === -1);
  ok('REVISIT = -3', REWARDS.REVISIT === -3);

  section('Action deltas match spec');
  ok('UP = [-1, 0]', ACTION_DELTAS[ACTIONS.UP][0] === -1 && ACTION_DELTAS[ACTIONS.UP][1] === 0);
  ok('DOWN = [+1, 0]', ACTION_DELTAS[ACTIONS.DOWN][0] === 1 && ACTION_DELTAS[ACTIONS.DOWN][1] === 0);
  ok('LEFT = [0, -1]', ACTION_DELTAS[ACTIONS.LEFT][0] === 0 && ACTION_DELTAS[ACTIONS.LEFT][1] === -1);
  ok('RIGHT = [0, +1]', ACTION_DELTAS[ACTIONS.RIGHT][0] === 0 && ACTION_DELTAS[ACTIONS.RIGHT][1] === 1);

  section('Environment.step() reward logic');
  // 3x3 maze where (0,1) is a wall; expect WALL_HIT then STEP rewards
  const m: number[][] = [
    [0, 1, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const env = new MazeEnvironment(m, [0, 0], [2, 2]);
  // Move RIGHT into wall
  let r = env.step(ACTIONS.RIGHT);
  ok('Wall hit gives -10', r.reward === REWARDS.WALL_HIT, `got ${r.reward}`);
  ok('Position unchanged on wall hit', r.nextState.position[0] === 0 && r.nextState.position[1] === 0);
  ok('Wall hit info flag set', r.info.hitWall === true);
  // Move DOWN to (1,0): legal step
  r = env.step(ACTIONS.DOWN);
  ok('Legal step gives -1', r.reward === REWARDS.STEP, `got ${r.reward}`);
  ok('Position is (1,0)', r.nextState.position[0] === 1 && r.nextState.position[1] === 0);
  // Move UP back to (0,0): revisit
  r = env.step(ACTIONS.UP);
  ok('Revisit gives -3', r.reward === REWARDS.REVISIT, `got ${r.reward}`);
  ok('Revisit info flag set', r.info.revisit === true);

  section('Environment.step() goal reward & done flag');
  const env2 = new MazeEnvironment(emptyMaze(3, 3), [0, 0], [0, 1]);
  const g = env2.step(ACTIONS.RIGHT);
  ok('Goal reward = +100', g.reward === REWARDS.GOAL);
  ok('Goal triggers done', g.done === true);
  ok('Goal info flag set', g.info.reachedGoal === true);

  section('Environment.reset() restores initial state');
  const env3 = new MazeEnvironment(emptyMaze(3, 3), [0, 0], [2, 2]);
  env3.step(ACTIONS.RIGHT);
  env3.step(ACTIONS.DOWN);
  const reset = env3.reset();
  ok('After reset: position back to start', reset.position[0] === 0 && reset.position[1] === 0);
  ok('After reset: steps = 0', reset.steps === 0);
  ok('After reset: totalReward = 0', reset.totalReward === 0);

  section('getValidActions returns only legal moves');
  // Corner cell (0,0) on empty 3x3: only DOWN and RIGHT
  const env4 = new MazeEnvironment(emptyMaze(3, 3), [0, 0], [2, 2]);
  const valid = env4.getValidActions([0, 0]);
  ok('Corner has 2 valid actions', valid.length === 2, `got ${valid.length}`);
  ok('DOWN is valid from (0,0)', valid.includes(ACTIONS.DOWN));
  ok('RIGHT is valid from (0,0)', valid.includes(ACTIONS.RIGHT));
  ok('UP is NOT valid from (0,0)', !valid.includes(ACTIONS.UP));
  ok('LEFT is NOT valid from (0,0)', !valid.includes(ACTIONS.LEFT));

  section('maxSteps termination');
  // Force agent to bounce against a wall forever — should terminate via maxSteps
  const small = emptyMaze(2, 2);
  const env5 = new MazeEnvironment(small, [0, 0], [1, 1], 5);
  let done = false;
  let n = 0;
  while (!done) {
    const result = env5.step(ACTIONS.UP); // always hits wall (out of bounds)
    done = result.done;
    n++;
    if (n > 100) break;
  }
  ok('maxSteps termination triggers', n === 5, `terminated at step ${n}, expected 5`);
}

// =============================================================================
// Round 5 — BFS / DFS correctness on grid mazes
// =============================================================================
async function round5() {
  section('BFS and DFS find a path on hand-built maze');
  const m5: number[][] = [
    [0, 0, 0, 1, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
  ];
  const br = bfs(m5, [0, 0], [4, 4]);
  const dr = dfs(m5, [0, 0], [4, 4]);
  ok('BFS found path', br.found);
  ok('DFS found path', dr.found);
  ok('BFS path connected', isPathConnected(m5, br.path));
  ok('DFS path connected', isPathConnected(m5, dr.path));

  section('BFS path length equals A* / Dijkstra (optimal on unweighted)');
  const ar = astar(m5, [0, 0], [4, 4]);
  ok(
    'BFS optimal == A* optimal',
    br.path.length === ar.path.length,
    `bfs=${br.path.length}, astar=${ar.path.length}`
  );

  section('DFS path is valid even if not shortest');
  ok('DFS path length >= optimal', dr.path.length >= ar.path.length);

  section('All four search algorithms produce a parents map');
  ok('BFS exposes parents', !!br.parents && br.parents.size > 0);
  ok('DFS exposes parents', !!dr.parents && dr.parents.size > 0);
  ok('A* exposes parents', !!ar.parents && ar.parents.size > 0);
  const dij = dijkstra(m5, [0, 0], [4, 4]);
  ok('Dijkstra exposes parents', !!dij.parents && dij.parents.size > 0);

  section('BFS / DFS agree on existence across 20 random mazes');
  let agree = 0;
  for (let i = 0; i < 20; i++) {
    const m = generateMaze(15, 15);
    const b = bfs(m, [0, 0], [14, 14]);
    const d = dfs(m, [0, 0], [14, 14]);
    if (b.found && d.found) agree++;
  }
  ok('BFS and DFS find path 20/20', agree === 20, `got ${agree}`);
}

// =============================================================================
// Round 6 — Graph maze + weighted algorithms
// =============================================================================
async function round6() {
  section('Graph generator produces a connected graph (start -> goal)');
  for (let i = 0; i < 10; i++) {
    const g = generateGraphMaze(12, { connectivity: 3 });
    const r = bfsGraph(g);
    ok(`graph ${i}: bfs reaches goal`, r.found);
  }

  section('Romania map preset is well-formed');
  const romania = romaniaMap();
  ok('Romania has 20 nodes', romania.nodes.length === 20, `got ${romania.nodes.length}`);
  ok('Romania start = Arad', romania.startId === 'Arad');
  ok('Romania goal = Bucharest', romania.goalId === 'Bucharest');

  section('Romania map: classical shortest path Arad -> Bucharest = 418');
  const dij = dijkstraGraph(romania);
  ok('Dijkstra finds path', dij.found);
  ok(
    `Dijkstra cost = 418 (got ${dij.pathCost})`,
    dij.pathCost === 418,
    `got ${dij.pathCost}`
  );
  const a = astarGraph(romania);
  ok('A* finds same optimal cost', a.pathCost === dij.pathCost, `astar=${a.pathCost}`);

  section('On Romania, BFS may find a higher-cost path than Dijkstra (proves weights matter)');
  const b = bfsGraph(romania);
  ok('BFS found path', b.found);
  ok(
    'BFS cost >= Dijkstra cost (typical for weighted graphs)',
    b.pathCost >= dij.pathCost,
    `bfs=${b.pathCost} dij=${dij.pathCost}`
  );

  section('DFS on Romania finds *a* path');
  const dfsR = dfsGraph(romania);
  ok('DFS found path', dfsR.found);
  // DFS path cost not bounded — just verify it walks valid edges
  const adj = adjacencyMap(romania.nodes, romania.edges);
  let valid = true;
  for (let i = 1; i < dfsR.path.length; i++) {
    const prev = dfsR.path[i - 1];
    const cur = dfsR.path[i];
    if (!(adj.get(prev) ?? []).some((e) => e.to === cur)) {
      valid = false;
      break;
    }
  }
  ok('DFS path uses only real edges', valid);

  section('A* on random graphs: cost equals Dijkstra (admissible heuristic)');
  let match = 0;
  for (let i = 0; i < 10; i++) {
    const g = generateGraphMaze(10, { connectivity: 3 });
    const dr = dijkstraGraph(g);
    const ar = astarGraph(g);
    if (dr.found && ar.found && dr.pathCost === ar.pathCost) match++;
  }
  ok('A* matches Dijkstra optimal cost 10/10', match === 10, `got ${match}`);

  section('All four graph algorithms expose a parents map');
  const g = generateGraphMaze(10);
  ok('bfsGraph parents', bfsGraph(g).parents.size > 0);
  ok('dfsGraph parents', dfsGraph(g).parents.size > 0);
  ok('dijkstraGraph parents', dijkstraGraph(g).parents.size > 0);
  ok('astarGraph parents', astarGraph(g).parents.size > 0);
}

// =============================================================================
// Round 5 (browser smoke) happens outside this file
// =============================================================================

(async () => {
  console.log('================================================');
  console.log(' Maze Solver — End-to-End Test Suite');
  console.log('================================================');
  await runRound(2, 'Algorithm correctness', round2);
  await runRound(3, 'Edge cases', round3);
  await runRound(4, 'Environment + reward correctness', round4);
  await runRound(5, 'BFS / DFS on grid mazes', round5);
  await runRound(6, 'Graph mazes + weighted algorithms', round6);

  console.log('\n================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('================================================');
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  •', f);
    process.exit(1);
  }
})();
