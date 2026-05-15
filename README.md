# Maze Solver AI

> **AI University Project** — comparing Reinforcement Learning agents (Q-Learning, DQN) against classical search algorithms (A*, Dijkstra) on procedurally generated mazes. Built as a fully interactive, **client-side** Next.js web app.

🔗 **Live Demo:** `https://your-project.vercel.app` _(replace after deploy)_

---

## ✨ Features

- **4 algorithms, one maze** — A*, Dijkstra, tabular Q-Learning, and a from-scratch DQN with a TypeScript neural network.
- **Interactive maze editor** — random generation, presets (easy / medium / hard), or click cells to draw your own walls.
- **Live training visuals** — watch search algorithms explore in real time and RL agents converge episode by episode.
- **Side-by-side comparison** — run all four algorithms on the same maze; inspect path length, time, and states explored on shared charts.
- **Full academic report page** — printable to PDF directly from the browser.
- **100% client-side** — no backend, no Python, no external APIs. Everything runs in your browser.

## 🛠 Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, static export) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Animation | Framer Motion + Canvas |
| Deploy | Vercel (zero-config) |

## 🚀 Running locally

```bash
npm install
npm run dev     # http://localhost:3000
```

## 🏗 Production build

```bash
npm run build   # generates the /out static bundle
```

The build uses `output: 'export'`, so the contents of `/out` can be deployed to any static host.

## ☁️ Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Vercel auto-detects Next.js — no configuration needed.

## 📁 Project structure

```
maze-solver/
├── app/
│   ├── layout.tsx           # Root layout, fonts, dark theme
│   ├── page.tsx             # Landing page with animated hero
│   ├── maze/page.tsx        # Main interactive maze + controls
│   ├── comparison/page.tsx  # Run-all dashboard
│   ├── report/page.tsx      # Printable academic report
│   └── globals.css
├── components/              # Canvas, charts, control panels
├── lib/
│   ├── maze/                # types, generator, environment, presets
│   ├── algorithms/          # astar, dijkstra, qlearning, dqn
│   └── utils/               # colors, helpers
└── README.md
```

## 🧠 Algorithm summary

- **A*** — Best-first search with Manhattan-distance heuristic. Optimal on grids; fastest in practice for known maps.
- **Dijkstra** — Uniform-cost search; A* with `h = 0`. Same optimal answer but explores more states.
- **Q-Learning** — Tabular RL. Maintains `Q[s,a]` and improves it via ε-greedy exploration plus the standard Bellman update.
- **DQN** — Deep Q-Network with a small MLP (`2 → 32 → 32 → 4`) implemented from scratch in TypeScript. Uses a target network and experience replay.

## 👥 Team

_Add team member names here._

## 📄 License

Educational use.
