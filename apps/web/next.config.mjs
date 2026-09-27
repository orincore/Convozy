/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@convozy/shared'],
  // geoip-country reads its bundled .dat files via fs + __dirname at
  // runtime - bundling it would break that relative path resolution.
  serverExternalPackages: ['geoip-country'],
  // next/image handles responsive/optimized images for Core Web Vitals
  // (CLAUDE.md §11 performance requirement) — configure remote patterns
  // here once real image sources (e.g. a CDN) are decided.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
