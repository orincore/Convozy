import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

/**
 * Generated sitemap (Next.js convention — served at /sitemap.xml).
 * CLAUDE.md §11: every new public route must be reflected here automatically.
 * As marketing routes are added (Phase 7), add them to this array — or, once
 * there are enough dynamic routes (blog posts, feature pages from a CMS),
 * generate this list from that data source instead of hardcoding it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '/',
    '/pricing',
    '/donate',
    '/features',
    '/features/comment-to-dm',
    '/privacy',
    '/terms',
    '/data-deletion',
  ];

  const legalRoutes = new Set(['/privacy', '/terms', '/data-deletion']);

  return staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '/' ? 1 : legalRoutes.has(route) ? 0.3 : 0.7,
  }));
}
