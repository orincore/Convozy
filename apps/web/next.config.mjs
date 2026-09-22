/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@convozy/shared'],
  // next/image handles responsive/optimized images for Core Web Vitals
  // (CLAUDE.md §11 performance requirement) — configure remote patterns
  // here once real image sources (e.g. a CDN) are decided.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
