'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/maze', label: 'Grid Maze' },
  { href: '/graph', label: 'Graph Maze' },
  { href: '/comparison', label: 'Comparison' },
  { href: '/report', label: 'Report' },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="no-print sticky top-0 z-30 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-start to-qlearn flex items-center justify-center text-base font-bold text-base">
            M
          </div>
          <span className="font-semibold tracking-tight group-hover:text-white text-gray-200">
            Maze Solver AI
          </span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
