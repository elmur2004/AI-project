/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: removed `output: 'export'` and `trailingSlash: true` because Vercel
  // deploys Next.js apps natively from `.next/` and handles routing itself.
  // The app is still fully client-rendered, so every page is statically
  // generated at build time.
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;
