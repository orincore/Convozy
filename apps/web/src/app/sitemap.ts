import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

/**
 * Generated sitemap (Next.js convention — served at /sitemap.xml).
 * CLAUDE.md §11: every new public route must be reflected here automatically.
 * As marketing routes are added (Phase 7), add them to this array — or, once
 * there are enough dynamic routes (blog posts, feature pages from a CMS),
 * generate this list from that data source instead of hardcoding it.
 */
// Real last-significant-content-change date per route, not the build/request
// time - a sitemap where every URL shares today's date on every crawl tells
// Google nothing about what actually changed, and gets discounted over time.
// Bump ONLY the route(s) you actually edited, not this whole map, whenever
// their content meaningfully changes.
const LAST_MODIFIED: Record<string, string> = {
  '/': '2026-09-27',
  '/pricing': '2026-09-27',
  '/donate': '2026-09-27',
  '/features': '2026-09-27',
  '/features/comment-to-dm': '2026-09-27',
  '/manychat-alternative': '2026-10-01',
  '/privacy': '2026-09-27',
  '/terms': '2026-09-27',
  '/data-deletion': '2026-09-27',
};

export default function sitemap(): MetadataRoute.Sitemap {
  const legalRoutes = new Set(['/privacy', '/terms', '/data-deletion']);

  return Object.entries(LAST_MODIFIED).map(([route, lastModified]) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: route === '/' ? 1 : legalRoutes.has(route) ? 0.3 : 0.7,
  }));
}
