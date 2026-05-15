'use client';

export default function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-sm text-gray-500 flex flex-col sm:flex-row gap-2 justify-between">
        <div>
          AI University Project · Maze Solver via Reinforcement Learning &amp; Search
        </div>
        <div className="text-gray-600">
          Built with Next.js · Algorithms run entirely in your browser
        </div>
      </div>
    </footer>
  );
}
