'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Cell } from '@/lib/maze/types';
import { COLORS } from '@/lib/utils/colors';
import { keyOf } from '@/lib/utils/helpers';

interface Props {
  parents: Map<string, Cell | null>;
  start: Cell;
  goal: Cell;
  path?: Cell[]; // highlighted path from start to goal
  color?: string;
  maxNodes?: number; // truncate huge trees so the canvas stays readable
  height?: number;
}

interface TreeNode {
  cell: Cell;
  key: string;
  depth: number;
  children: TreeNode[];
  x?: number;
  y?: number;
}

// Recursive layout that assigns x = column of next available leaf and
// centers parents above their children. Standard "tidy tree" approach
// without optimization — fine up to a few hundred nodes.
function layoutTree(
  root: TreeNode,
  yGap: number,
  xGap: number
): { width: number; nodes: TreeNode[] } {
  let nextX = 0;
  const nodes: TreeNode[] = [];

  const recurse = (node: TreeNode): void => {
    if (node.children.length === 0) {
      node.x = nextX * xGap;
      nextX++;
    } else {
      for (const child of node.children) recurse(child);
      const first = node.children[0].x!;
      const last = node.children[node.children.length - 1].x!;
      node.x = (first + last) / 2;
    }
    node.y = node.depth * yGap;
    nodes.push(node);
  };

  recurse(root);
  return { width: nextX * xGap, nodes };
}

export default function SearchTreeCanvas({
  parents,
  start,
  goal,
  path,
  color = COLORS.start,
  maxNodes = 300,
  height = 280,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => {
    if (!parents || parents.size === 0) return null;

    // Build adjacency from parents map
    const childrenOf = new Map<string, TreeNode[]>();
    const nodeByKey = new Map<string, TreeNode>();
    parents.forEach((parent, key) => {
      const [r, c] = key.split(',').map(Number);
      const node: TreeNode = { cell: [r, c], key, depth: 0, children: [] };
      nodeByKey.set(key, node);
    });

    let rootKey: string | null = null;
    parents.forEach((parent, key) => {
      const node = nodeByKey.get(key)!;
      if (parent === null) {
        rootKey = key;
      } else {
        const pKey = keyOf(parent[0], parent[1]);
        const list = childrenOf.get(pKey) ?? [];
        list.push(node);
        childrenOf.set(pKey, list);
      }
    });

    if (!rootKey) return null;
    const root = nodeByKey.get(rootKey)!;

    // BFS over the discovered tree to assign depths & attach children
    const queue: TreeNode[] = [root];
    root.depth = 0;
    const all: TreeNode[] = [];
    while (queue.length > 0) {
      const n = queue.shift()!;
      all.push(n);
      n.children = childrenOf.get(n.key) ?? [];
      n.children.sort((a, b) => a.key.localeCompare(b.key));
      for (const c of n.children) {
        c.depth = n.depth + 1;
        queue.push(c);
      }
      if (all.length >= maxNodes) break;
    }

    // If we truncated, prune children references that point past the limit
    if (all.length >= maxNodes) {
      const allowed = new Set(all.map((n) => n.key));
      for (const n of all) n.children = n.children.filter((c) => allowed.has(c.key));
    }

    return { root, all, truncated: all.length >= maxNodes };
  }, [parents, maxNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !tree) return;

    const availW = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;

    const yGap = Math.max(28, height / Math.max(1, Math.max(...tree.all.map((n) => n.depth)) + 1));
    const xGap = 16; // base; will scale to fit width
    const layout = layoutTree(tree.root, yGap, xGap);
    const scaleX = layout.width > 0 ? Math.min(1, (availW - 40) / layout.width) : 1;

    const w = Math.max(availW, layout.width * scaleX + 40);
    const h = (Math.max(...tree.all.map((n) => n.depth)) + 1) * yGap + 40;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const offX = 20;
    const offY = 20;
    const px = (n: TreeNode) => offX + n.x! * scaleX;
    const py = (n: TreeNode) => offY + n.y!;

    // Edges
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (const n of tree.all) {
      for (const c of n.children) {
        ctx.beginPath();
        ctx.moveTo(px(n), py(n));
        ctx.lineTo(px(c), py(c));
        ctx.stroke();
      }
    }

    // Highlight path edges
    if (path && path.length > 1) {
      const pathSet = new Set(path.map(([r, c]) => keyOf(r, c)));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      for (const n of tree.all) {
        if (!pathSet.has(n.key)) continue;
        for (const c of n.children) {
          if (!pathSet.has(c.key)) continue;
          ctx.beginPath();
          ctx.moveTo(px(n), py(n));
          ctx.lineTo(px(c), py(c));
          ctx.stroke();
        }
      }
    }

    // Nodes
    const pathSet = new Set((path ?? []).map(([r, c]) => keyOf(r, c)));
    const goalKey = keyOf(goal[0], goal[1]);
    const startKey = keyOf(start[0], start[1]);
    for (const n of tree.all) {
      const radius = pathSet.has(n.key) ? 5 : 3;
      let fill = 'rgba(156,163,175,0.7)';
      if (n.key === startKey) fill = COLORS.start;
      else if (n.key === goalKey) fill = COLORS.goal;
      else if (pathSet.has(n.key)) fill = color;
      ctx.beginPath();
      ctx.arc(px(n), py(n), radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    }

    // Depth labels on left margin
    ctx.fillStyle = 'rgba(156,163,175,0.6)';
    ctx.font = '10px ui-monospace, monospace';
    const maxDepth = Math.max(...tree.all.map((n) => n.depth));
    for (let d = 0; d <= maxDepth; d++) {
      ctx.fillText(`L${d}`, 2, offY + d * yGap + 3);
    }
  }, [tree, height, color, path, start, goal]);

  if (!tree) {
    return (
      <div className="text-xs text-gray-500 italic">
        Run BFS, DFS, A*, or Dijkstra to build the search tree.
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto" ref={containerRef}>
      <canvas ref={canvasRef} />
      {tree.truncated && (
        <div className="text-[10px] text-gray-500 mt-1">
          (showing first {maxNodes} discovered nodes — tree truncated for readability)
        </div>
      )}
    </div>
  );
}
